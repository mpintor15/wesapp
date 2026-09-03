const db = require('../config/database');
const logger = require('../config/logger');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const {
  CLIENT_HAS_RELATIONS_MESSAGE,
  deleteClienteWithoutRelations,
} = require('../services/clientesDeletionService');

const ESTADO_UBICACIONES_VALUES = new Set(['con_ubicaciones', 'sin_ubicaciones']);

const MAX_NOMBRE_LENGTH = 100;
const VALID_ESTADOS = new Set(['activo', 'inactivo']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const VALID_TIPOS_IDENTIFICACION = new Set(['CEDULA', 'RUC', 'PASAPORTE']);
const IDENTIFICACION_RULES = {
  CEDULA: { length: 10, message: 'La cédula debe tener exactamente 10 dígitos numéricos' },
  RUC: { length: 13, message: 'El RUC debe tener exactamente 13 dígitos numéricos' },
};

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
};

const normalizeClientePayload = (payload = {}) => {
  const nombre = normalizeText(payload.nombre);
  if (!nombre) {
    return { valid: false, status: 400, message: 'El nombre del cliente es obligatorio' };
  }
  if (nombre.length > MAX_NOMBRE_LENGTH) {
    return {
      valid: false,
      status: 400,
      message: `El nombre no puede exceder ${MAX_NOMBRE_LENGTH} caracteres`,
    };
  }

  const correo = normalizeText(payload.correo)?.toLowerCase() || null;
  if (correo && !EMAIL_REGEX.test(correo)) {
    return { valid: false, status: 400, message: 'El correo del cliente es inválido' };
  }

  const estado = normalizeText(payload.estado)?.toLowerCase() || 'activo';
  if (!VALID_ESTADOS.has(estado)) {
    return { valid: false, status: 400, message: 'El estado del cliente es inválido' };
  }

  const tipoIdentificacion = normalizeText(payload.tipo_identificacion)?.toUpperCase() || null;
  if (tipoIdentificacion && !VALID_TIPOS_IDENTIFICACION.has(tipoIdentificacion)) {
    return { valid: false, status: 400, message: 'El tipo de identificación es inválido' };
  }

  const identificacion = normalizeText(payload.identificacion);
  const idRule = tipoIdentificacion && IDENTIFICACION_RULES[tipoIdentificacion];
  if (
    idRule &&
    identificacion &&
    (!/^\d+$/.test(identificacion) || identificacion.length !== idRule.length)
  ) {
    return { valid: false, status: 400, message: idRule.message };
  }

  const telefono = normalizeText(payload.telefono);
  if (telefono && !PHONE_REGEX.test(telefono)) {
    return {
      valid: false,
      status: 400,
      message: 'El teléfono debe tener exactamente 10 dígitos numéricos',
    };
  }

  return {
    valid: true,
    value: {
      nombre,
      identificacion,
      tipo_identificacion: tipoIdentificacion,
      telefono,
      correo,
      direccion: normalizeText(payload.direccion),
      ciudad: normalizeText(payload.ciudad),
      estado,
    },
  };
};

const parsePositiveInteger = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  if (!/^[1-9]\d*$/.test(String(value).trim())) {
    return null;
  }
  return Number(value);
};

const parseClienteId = (value) => {
  const id = parsePositiveInteger(value);
  if (!id) {
    return { valid: false, status: 400, message: 'El cliente es inválido' };
  }
  return { valid: true, value: id };
};

const sendError = (res, status, message, extra = {}) =>
  res.status(status).json({
    success: false,
    message,
    ...extra,
  });

const isDuplicateIdentificationError = (error) =>
  error?.code === '23505' &&
  String(error?.constraint || '').includes('idx_clientes_identificacion_normalizada_unique');

const handleClienteError = (res, error, fallback) => {
  if (error?.status && error?.message) {
    return sendError(res, error.status, error.message, {
      ...(error.appCode ? { code: error.appCode } : {}),
      ...(error.details ? { details: error.details } : {}),
    });
  }
  if (isDuplicateIdentificationError(error)) {
    return sendError(res, 409, 'Ya existe un cliente con esa identificación');
  }
  if (error?.code === '23505') {
    return sendError(res, 409, 'Ya existe un cliente con ese nombre o identificación');
  }
  if (error?.code === '23503') {
    return sendError(res, 409, CLIENT_HAS_RELATIONS_MESSAGE, {
      code: 'CLIENT_HAS_RELATIONS',
      details: { ubicaciones: 0, facturas: 0, pagos: 0 },
    });
  }

  logger.error(fallback, {
    code: error?.code,
    message: error?.message,
  });
  return sendError(res, 500, 'Error en el servidor');
};

const ensureUniqueIdentification = async (client, identificacion, currentId = null) => {
  if (!identificacion) {
    return;
  }

  const result = await client.query(
    `SELECT id
     FROM clientes
     WHERE identificacion IS NOT NULL
       AND TRIM(identificacion) <> ''
       AND LOWER(TRIM(identificacion)) = LOWER(TRIM($1))
       AND ($2::integer IS NULL OR id <> $2)
     LIMIT 1`,
    [identificacion, currentId]
  );

  if (result.rowCount > 0) {
    const error = new Error('Ya existe un cliente con esa identificación');
    error.status = 409;
    throw error;
  }
};

const getClientes = async (req, res) => {
  try {
    const search = normalizeText(req.query.search);
    const estado = normalizeText(req.query.estado)?.toLowerCase() || null;
    const estadoUbicaciones = normalizeText(req.query.estadoUbicaciones)?.toLowerCase() || null;
    const ubicacionIdRaw = normalizeText(req.query.ubicacionId);
    const ubicacionId = ubicacionIdRaw ? Number(ubicacionIdRaw) : null;

    if (estado && !VALID_ESTADOS.has(estado)) {
      return sendError(res, 400, 'El estado del cliente es inválido');
    }
    if (estadoUbicaciones && !ESTADO_UBICACIONES_VALUES.has(estadoUbicaciones)) {
      return sendError(res, 400, 'El filtro de ubicaciones es inválido');
    }
    if (ubicacionIdRaw && (!Number.isInteger(ubicacionId) || ubicacionId <= 0)) {
      return sendError(res, 400, 'La Ubicación es inválida');
    }

    const pagination = normalizePaginationQuery(req.query);

    const params = [];
    const filters = [];

    if (search) {
      // El teléfono se compara por un "núcleo" de dígitos: se le quita el
      // prefijo de país 593 o un 0 inicial (uno de los dos, nunca ambos),
      // igual que Ecuador escribe el mismo número en formato local
      // (0999999999) o internacional (+593999999999).
      const searchDigits = search.replace(/\D/g, '');
      const searchCore = searchDigits.replace(/^593/, '').replace(/^0/, '');
      params.push(`%${search.toLowerCase()}%`);
      const searchIdx = params.length;
      params.push(searchCore);
      const coreIdx = params.length;
      filters.push(`(
        LOWER(clientes.nombre) LIKE $${searchIdx}
        OR LOWER(COALESCE(clientes.identificacion, '')) LIKE $${searchIdx}
        OR LOWER(COALESCE(clientes.correo, '')) LIKE $${searchIdx}
        OR (
          $${coreIdx} <> ''
          AND regexp_replace(
            regexp_replace(COALESCE(clientes.telefono, ''), '\\D', '', 'g'),
            '^593|^0', ''
          ) LIKE '%' || $${coreIdx} || '%'
        )
      )`);
    }

    if (estado) {
      params.push(estado);
      filters.push(`clientes.estado = $${params.length}`);
    }

    if (ubicacionId) {
      params.push(ubicacionId);
      filters.push(`EXISTS (
        SELECT 1 FROM ubicaciones
        WHERE ubicaciones.cliente_id = clientes.id AND ubicaciones.id = $${params.length}
      )`);
    }

    if (estadoUbicaciones === 'con_ubicaciones') {
      filters.push('COALESCE(ubicaciones_cliente.ubicaciones_totales, 0) > 0');
    } else if (estadoUbicaciones === 'sin_ubicaciones') {
      filters.push('COALESCE(ubicaciones_cliente.ubicaciones_totales, 0) = 0');
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    params.push(pagination.pageSize, pagination.offset);
    const result = await db.query(
      `SELECT clientes.id, clientes.nombre, clientes.identificacion, clientes.tipo_identificacion,
              clientes.telefono, clientes.correo, clientes.direccion, clientes.ciudad,
              clientes.estado, clientes.created_at, clientes.updated_at,
              COALESCE(ubicaciones_totales, 0)::int AS ubicaciones_totales,
              COUNT(*) OVER()::int AS total_filtrado
       FROM clientes
       LEFT JOIN (
         SELECT cliente_id, COUNT(*)::int AS ubicaciones_totales
         FROM ubicaciones
         WHERE cliente_id IS NOT NULL
         GROUP BY cliente_id
       ) ubicaciones_cliente ON ubicaciones_cliente.cliente_id = clientes.id
       ${where}
       ORDER BY clientes.nombre ASC, clientes.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const totals = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE estado = 'activo')::int AS activos,
         COUNT(*) FILTER (WHERE estado = 'inactivo')::int AS inactivos
       FROM clientes`
    );
    const totalFiltrado = result.rows[0]?.total_filtrado || 0;

    res.json({
      success: true,
      data: result.rows.map(({ total_filtrado: _totalFiltrado, ...cliente }) => cliente),
      meta: {
        total: totals.rows[0]?.total || 0,
        activos: totals.rows[0]?.activos || 0,
        inactivos: totals.rows[0]?.inactivos || 0,
        filtrados: totalFiltrado,
      },
      pagination: buildPaginationMetadata({
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: totalFiltrado,
      }),
    });
  } catch (error) {
    return handleClienteError(res, error, 'Error al obtener clientes');
  }
};

const getClientesOpcionesUbicaciones = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, nombre, estado
       FROM clientes
       WHERE estado = $1
       ORDER BY nombre ASC, id ASC`,
      ['activo']
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return handleClienteError(res, error, 'Error al obtener opciones de clientes');
  }
};

const getClienteById = async (req, res) => {
  const idValidation = parseClienteId(req.params.id);
  if (!idValidation.valid) {
    return sendError(res, idValidation.status, idValidation.message);
  }

  try {
    const result = await db.query(
      `SELECT id, nombre, identificacion, tipo_identificacion, telefono, correo,
              direccion, ciudad, estado, created_at, updated_at
       FROM clientes
       WHERE id = $1`,
      [idValidation.value]
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, 'Cliente no encontrado');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return handleClienteError(res, error, 'Error al obtener cliente');
  }
};

const createCliente = async (req, res) => {
  const validation = normalizeClientePayload(req.body);
  if (!validation.valid) {
    return sendError(res, validation.status, validation.message);
  }

  try {
    const cliente = await db.transaction(async (client) => {
      await ensureUniqueIdentification(client, validation.value.identificacion);
      const result = await client.query(
        `INSERT INTO clientes (
          nombre, identificacion, tipo_identificacion, telefono, correo, direccion, ciudad, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, nombre, identificacion, tipo_identificacion, telefono, correo,
                  direccion, ciudad, estado, created_at, updated_at`,
        [
          validation.value.nombre,
          validation.value.identificacion,
          validation.value.tipo_identificacion,
          validation.value.telefono,
          validation.value.correo,
          validation.value.direccion,
          validation.value.ciudad,
          validation.value.estado,
        ]
      );
      await logAuditStrict(client, {
        tabla: 'clientes',
        operacion: 'INSERT',
        registro_id: String(result.rows[0].id),
        datos_nuevos: result.rows[0],
        ...auditFromReq(req),
      });
      return result.rows[0];
    });

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: cliente,
    });
  } catch (error) {
    return handleClienteError(res, error, 'Error al crear cliente');
  }
};

const updateCliente = async (req, res) => {
  const idValidation = parseClienteId(req.params.id);
  if (!idValidation.valid) {
    return sendError(res, idValidation.status, idValidation.message);
  }

  const validation = normalizeClientePayload(req.body);
  if (!validation.valid) {
    return sendError(res, validation.status, validation.message);
  }

  try {
    const cliente = await db.transaction(async (client) => {
      const current = await client.query(
        `SELECT id, nombre, identificacion, tipo_identificacion, telefono, correo,
                direccion, ciudad, estado
         FROM clientes
         WHERE id = $1
         FOR UPDATE`,
        [idValidation.value]
      );

      if (current.rowCount === 0) {
        const error = new Error('Cliente no encontrado');
        error.status = 404;
        throw error;
      }

      await ensureUniqueIdentification(client, validation.value.identificacion, idValidation.value);
      const result = await client.query(
        `UPDATE clientes
         SET nombre = $1,
             identificacion = $2,
             tipo_identificacion = $3,
             telefono = $4,
             correo = $5,
             direccion = $6,
             ciudad = $7,
             estado = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING id, nombre, identificacion, tipo_identificacion, telefono, correo,
                   direccion, ciudad, estado, created_at, updated_at`,
        [
          validation.value.nombre,
          validation.value.identificacion,
          validation.value.tipo_identificacion,
          validation.value.telefono,
          validation.value.correo,
          validation.value.direccion,
          validation.value.ciudad,
          validation.value.estado,
          idValidation.value,
        ]
      );
      await logAuditStrict(client, {
        tabla: 'clientes',
        operacion: 'UPDATE',
        registro_id: String(idValidation.value),
        datos_anteriores: current.rows[0],
        datos_nuevos: result.rows[0],
        ...auditFromReq(req),
      });
      return result.rows[0];
    });

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: cliente,
    });
  } catch (error) {
    return handleClienteError(res, error, 'Error al actualizar cliente');
  }
};

const deleteCliente = async (req, res) => {
  const idValidation = parseClienteId(req.params.id);
  if (!idValidation.valid) {
    return sendError(res, idValidation.status, idValidation.message);
  }

  try {
    const cliente = await db.transaction(async (client) => {
      return deleteClienteWithoutRelations({
        executor: client,
        clienteId: idValidation.value,
        audit: (deletedCliente) =>
          logAuditStrict(client, {
            tabla: 'clientes',
            operacion: 'DELETE',
            registro_id: String(idValidation.value),
            datos_anteriores: deletedCliente,
            ...auditFromReq(req),
          }),
      });
    });

    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente',
      data: cliente,
    });
  } catch (error) {
    return handleClienteError(res, error, 'Error al eliminar cliente');
  }
};

module.exports = {
  createCliente,
  deleteCliente,
  getClienteById,
  getClientes,
  getClientesOpcionesUbicaciones,
  updateCliente,
};
