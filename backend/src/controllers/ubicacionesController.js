const db = require('../config/database');
const logger = require('../config/logger');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { parseStrictPositiveInteger } = require('../utils/inputValidation');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const { sanitizeError } = require('../utils/logSanitizer');
const { assertClienteActivoForOperation } = require('../services/clientesStateService');
const { findGroupedLocations, toBoolean } = require('../repositories/ubicacionesGroupedRepository');

const normalizeName = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const GROUPED_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ALLOWED_POINT_TYPES = new Set(['GENERAL', 'URBANIZACION']);

const parseId = (value) => {
  const result = parseStrictPositiveInteger(value, 'La ubicación es inválida');
  return result.valid ? result.value : null;
};

const parseClienteId = (value) => {
  const result = parseStrictPositiveInteger(value, 'El cliente es inválido');
  return result.valid ? result.value : null;
};

const createAppError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.appCode = code;
  return error;
};

const parseRequestedClienteId = (body) => {
  if (!Object.prototype.hasOwnProperty.call(body || {}, 'cliente_id')) {
    return { provided: false, value: undefined, valid: true };
  }
  const rawValue = body.cliente_id;
  if (rawValue === null) {
    return { provided: true, value: null, valid: true };
  }
  if (rawValue === '') {
    return { provided: true, value: null, valid: true };
  }
  const result = parseStrictPositiveInteger(rawValue, 'El cliente es inválido');
  return { provided: true, value: result.value, valid: result.valid };
};

const hasPositiveCount = (row, key) => Number(row?.[key] || 0) > 0;

const buildLocationDependencyError = (counts) => {
  const details = {
    articulos: Number(counts.articulos || 0),
    movimientos_origen: Number(counts.movimientos_origen || 0),
    movimientos_destino: Number(counts.movimientos_destino || 0),
    bajas: Number(counts.bajas || 0),
    stock_efectos: Number(counts.stock_efectos || 0),
  };
  const onlyArticles =
    details.articulos > 0 &&
    details.movimientos_origen === 0 &&
    details.movimientos_destino === 0 &&
    details.bajas === 0 &&
    details.stock_efectos === 0;

  const error = createAppError(
    409,
    'LOCATION_HAS_DEPENDENCIES',
    onlyArticles
      ? 'No se puede eliminar la ubicación porque tiene artículos asociados. Reasígnalos primero.'
      : 'No se puede eliminar la ubicación porque está asociada a registros de inventario.'
  );
  error.details = details;
  return error;
};

const sendError = (res, error, fallback) => {
  logger.error(fallback, { error: sanitizeError(error), status: error.status });
  if (error.appCode) {
    return res.status(error.status || 400).json({
      success: false,
      code: error.appCode,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe una ubicación con ese nombre para el cliente seleccionado',
    });
  }
  if (error.code === '23503') {
    return res.status(409).json({
      success: false,
      message: 'No se puede eliminar la ubicación porque está asociada a registros de inventario.',
    });
  }
  return res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : 'Error en el servidor',
  });
};

const validateName = (value) => {
  const nombre = normalizeName(value);
  if (!nombre) {
    const error = new Error('El nombre de la ubicación es obligatorio');
    error.status = 400;
    throw error;
  }
  if (nombre.length > 100) {
    const error = new Error('El nombre no puede exceder 100 caracteres');
    error.status = 400;
    throw error;
  }
  return nombre;
};

const validatePointType = (value = 'GENERAL') => {
  const tipoPunto = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!ALLOWED_POINT_TYPES.has(tipoPunto)) {
    const error = new Error('El tipo de punto debe ser GENERAL o URBANIZACION');
    error.status = 400;
    throw error;
  }
  return tipoPunto;
};

const getUbicaciones = async (req, res) => {
  try {
    const params = [];
    const conditions = [];
    const { cliente_id, sin_cliente, search } = req.query;

    if (cliente_id && sin_cliente === 'true') {
      return res.status(400).json({
        success: false,
        message: 'Los filtros cliente_id y sin_cliente no pueden combinarse',
      });
    }

    if (cliente_id) {
      const parsedClienteId = parseClienteId(cliente_id);
      if (!parsedClienteId) {
        return res.status(400).json({ success: false, message: 'El cliente es inválido' });
      }
      params.push(parsedClienteId);
      conditions.push(`u.cliente_id = $${params.length}`);
    }

    if (sin_cliente === 'true') {
      conditions.push('u.cliente_id IS NULL');
    } else if (sin_cliente && sin_cliente !== 'false') {
      return res.status(400).json({
        success: false,
        message: 'El filtro sin_cliente debe ser true o false',
      });
    }

    const normalizedSearch = typeof search === 'string' ? search.trim() : '';
    if (normalizedSearch) {
      if (normalizedSearch.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'El filtro de búsqueda no puede exceder 100 caracteres',
        });
      }
      params.push(`%${normalizedSearch}%`);
      conditions.push(`(u.nombre ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT
        u.id,
        u.nombre,
        u.tipo_punto,
        u.cliente_id,
        c.nombre AS cliente_nombre,
        c.estado AS cliente_estado,
        COUNT(a.id) FILTER (WHERE a.activo = TRUE)::int AS articulos_activos,
        COUNT(a.id)::int AS articulos_totales
      FROM ubicaciones u
      LEFT JOIN clientes c ON c.id = u.cliente_id
      LEFT JOIN articulos a ON a.ubicacion_id = u.id
      ${where}
      GROUP BY u.id, u.nombre, u.tipo_punto, u.cliente_id, c.nombre, c.estado
      ORDER BY c.nombre ASC NULLS LAST, u.nombre ASC
    `,
      params
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error, 'Error al obtener ubicaciones');
  }
};

const getUbicacionesAgrupadas = async (req, res) => {
  try {
    const normalizedSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (normalizedSearch.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El filtro de búsqueda no puede exceder 100 caracteres',
      });
    }

    const pagination = normalizePaginationQuery(req.query);
    if (!GROUPED_PAGE_SIZE_OPTIONS.includes(pagination.pageSize)) {
      return res.status(400).json({
        success: false,
        message: 'pageSize debe ser uno de 10, 25, 50 o 100',
      });
    }
    const includeEmpty = toBoolean(req.query.include_empty, true);
    const includeHistorical = toBoolean(req.query.include_historical, true);
    const { groups, totals } = await findGroupedLocations({
      search: normalizedSearch,
      includeEmpty,
      includeHistorical,
      pagination,
    });
    const basePagination = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: totals.filteredGroups,
    });

    return res.json({
      success: true,
      data: groups,
      meta: {
        page: basePagination.page,
        pageSize: basePagination.pageSize,
        totalGroups: totals.totalGroups,
        filteredGroups: totals.filteredGroups,
        totalLocations: totals.totalLocations,
        filteredLocations: totals.filteredLocations,
        totalPages: basePagination.totalPages,
      },
    });
  } catch (error) {
    return sendError(res, error, 'Error al obtener ubicaciones agrupadas');
  }
};

const createUbicacion = async (req, res) => {
  try {
    const nombre = validateName(req.body?.nombre);
    const tipoPunto = validatePointType(req.body?.tipo_punto);
    const requestedCliente = parseRequestedClienteId(req.body);
    if (!requestedCliente.valid) {
      return res.status(400).json({ success: false, message: 'El cliente es inválido' });
    }
    if (!requestedCliente.value) {
      return res.status(400).json({ success: false, message: 'El cliente es obligatorio' });
    }
    const clienteId = requestedCliente.value;

    const created = await db.transaction(async (client) => {
      const cliente = await assertClienteActivoForOperation({
        executor: client,
        clienteId,
        lockClause: 'FOR SHARE',
      });
      const duplicate = await client.query(
        `SELECT id
         FROM ubicaciones
         WHERE cliente_id = $1
           AND LOWER(TRIM(nombre)) = LOWER(TRIM($2))
         LIMIT 1`,
        [clienteId, nombre]
      );
      if (duplicate.rowCount > 0) {
        const error = new Error(
          'Ya existe una ubicación con ese nombre para el cliente seleccionado'
        );
        error.status = 409;
        throw error;
      }

      const result = await client.query(
        `INSERT INTO ubicaciones (nombre, cliente_id, tipo_punto)
         VALUES ($1, $2, $3) RETURNING id, nombre, cliente_id, tipo_punto`,
        [nombre, clienteId, tipoPunto]
      );
      const row = { ...result.rows[0], cliente_nombre: cliente.nombre };
      await logAuditStrict(client, {
        tabla: 'ubicaciones',
        operacion: 'INSERT',
        registro_id: row.id,
        datos_nuevos: row,
        ...auditFromReq(req),
      });
      return row;
    });

    return res.status(201).json({
      success: true,
      message: 'Ubicación creada exitosamente',
      data: { ...created, articulos_activos: 0, articulos_totales: 0 },
    });
  } catch (error) {
    return sendError(res, error, 'Error al crear ubicación');
  }
};

const updateUbicacion = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'La ubicación es inválida' });
    }
    const nombre = validateName(req.body?.nombre);
    const requestedCliente = parseRequestedClienteId(req.body);
    if (!requestedCliente.valid) {
      return res.status(400).json({ success: false, message: 'El cliente es inválido' });
    }

    const updated = await db.transaction(async (client) => {
      const current = await client.query(
        `SELECT u.id, u.nombre, u.tipo_punto, u.cliente_id, c.nombre AS cliente_nombre, c.estado AS cliente_estado
         FROM ubicaciones u
         LEFT JOIN clientes c ON c.id = u.cliente_id
         WHERE u.id = $1
         FOR UPDATE`,
        [id]
      );
      if (current.rowCount === 0) {
        const error = new Error('Ubicación no encontrada');
        error.status = 404;
        throw error;
      }

      const currentUbicacion = current.rows[0];
      const tipoPunto = Object.prototype.hasOwnProperty.call(req.body || {}, 'tipo_punto')
        ? validatePointType(req.body.tipo_punto)
        : currentUbicacion.tipo_punto || 'GENERAL';
      if (currentUbicacion.tipo_punto === 'URBANIZACION' && tipoPunto === 'GENERAL') {
        const manzanas = await client.query(
          'SELECT 1 FROM manzanas WHERE ubicacion_id = $1 LIMIT 1',
          [id]
        );
        if (manzanas.rowCount > 0) {
          throw createAppError(
            409,
            'LOCATION_HAS_BLOCKS',
            'No se puede cambiar a General una Urbanización que tiene Manzanas.'
          );
        }
      }
      const currentClienteId =
        currentUbicacion.cliente_id === null ? null : Number(currentUbicacion.cliente_id);
      const requestedClienteId = requestedCliente.provided
        ? requestedCliente.value
        : currentClienteId;
      const clienteChanged = currentClienteId !== requestedClienteId;
      if (currentClienteId !== null && requestedCliente.provided && requestedClienteId === null) {
        throw createAppError(
          409,
          'LOCATION_CLIENT_REQUIRED',
          'Una ubicación asociada a un cliente no puede quedar sin cliente'
        );
      }
      let cliente = {
        id: requestedClienteId,
        nombre: currentUbicacion.cliente_nombre,
        estado: currentUbicacion.cliente_estado,
      };
      if (clienteChanged && requestedClienteId !== null) {
        cliente = await assertClienteActivoForOperation({
          executor: client,
          clienteId: requestedClienteId,
          lockClause: 'FOR SHARE',
        });
      }

      if (requestedClienteId !== null) {
        const duplicate = await client.query(
          `SELECT id
           FROM ubicaciones
           WHERE cliente_id = $1
             AND LOWER(TRIM(nombre)) = LOWER(TRIM($2))
             AND id <> $3
           LIMIT 1`,
          [requestedClienteId, nombre, id]
        );
        if (duplicate.rowCount > 0) {
          const error = new Error(
            'Ya existe una ubicación con ese nombre para el cliente seleccionado'
          );
          error.status = 409;
          throw error;
        }
      }

      const result = await client.query(
        `UPDATE ubicaciones SET nombre = $1, cliente_id = $2, tipo_punto = $3
         WHERE id = $4 RETURNING id, nombre, cliente_id, tipo_punto`,
        [nombre, requestedClienteId, tipoPunto, id]
      );
      const row = {
        ...result.rows[0],
        cliente_nombre: requestedClienteId === null ? null : cliente.nombre,
      };
      await logAuditStrict(client, {
        tabla: 'ubicaciones',
        operacion: 'UPDATE',
        registro_id: id,
        datos_anteriores: current.rows[0],
        datos_nuevos: row,
        ...auditFromReq(req),
      });
      return row;
    });

    return res.json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Error al actualizar ubicación');
  }
};

const deleteUbicacion = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'La ubicación es inválida' });
    }

    const deleted = await db.transaction(async (client) => {
      const current = await client.query(
        `SELECT u.id, u.nombre, u.cliente_id, c.nombre AS cliente_nombre
         FROM ubicaciones u
         LEFT JOIN clientes c ON c.id = u.cliente_id
         WHERE u.id = $1
         FOR UPDATE OF u`,
        [id]
      );
      if (current.rowCount === 0) {
        const error = new Error('Ubicación no encontrada');
        error.status = 404;
        throw error;
      }

      const usage = await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM articulos WHERE ubicacion_id = $1) AS articulos,
          (SELECT COUNT(*)::int FROM detalle_movimientos WHERE ubicacion_origen_id = $1) AS movimientos_origen,
          (SELECT COUNT(*)::int FROM detalle_movimientos WHERE ubicacion_destino_id = $1) AS movimientos_destino,
          (SELECT COUNT(*)::int FROM articulos_bajas WHERE ubicacion_id = $1) AS bajas,
          (SELECT COUNT(*)::int
           FROM inventario_stock_efectos
           WHERE ubicacion_anterior_id = $1 OR ubicacion_posterior_id = $1) AS stock_efectos`,
        [id]
      );
      const counts = usage.rows[0] || {};
      if (
        hasPositiveCount(counts, 'articulos') ||
        hasPositiveCount(counts, 'movimientos_origen') ||
        hasPositiveCount(counts, 'movimientos_destino') ||
        hasPositiveCount(counts, 'bajas') ||
        hasPositiveCount(counts, 'stock_efectos')
      ) {
        throw buildLocationDependencyError(counts);
      }

      await client.query('DELETE FROM ubicaciones WHERE id = $1', [id]);
      await logAuditStrict(client, {
        tabla: 'ubicaciones',
        operacion: 'DELETE',
        registro_id: id,
        datos_anteriores: current.rows[0],
        ...auditFromReq(req),
      });
      return current.rows[0];
    });

    return res.json({ success: true, message: 'Ubicación eliminada exitosamente', data: deleted });
  } catch (error) {
    return sendError(res, error, 'Error al eliminar ubicación');
  }
};

module.exports = {
  getUbicaciones,
  getUbicacionesAgrupadas,
  createUbicacion,
  updateUbicacion,
  deleteUbicacion,
};
