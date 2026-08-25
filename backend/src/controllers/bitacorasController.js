const db = require('../config/database');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { isValidDateString } = require('../utils/inputValidation');
const {
  findHistory,
  findLockedUserLocationAssignment,
  findVisibleLocations,
} = require('../repositories/bitacorasRepository');

const BITACORA_STATES = new Set(['REGISTRADA', 'ANULADA']);
const HISTORY_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'ubicacion_id',
  'fecha_desde',
  'fecha_hasta',
  'estado',
  'autor',
]);

const hasGlobalLocationScope = (tipoUsuario) =>
  hasPermission(tipoUsuario, PERMISSIONS.BITACORAS_PUNTOS_VER_TODOS);

const getCurrentUserScope = async (userId, executor = db) => {
  const result = await executor.query(
    `SELECT id, tipo_usuario, activo
     FROM usuarios
     WHERE id = $1`,
    [userId]
  );
  if (result.rowCount === 0 || !result.rows[0].activo) {
    throw createHttpError(403, 'El Usuario autenticado no está disponible');
  }
  return {
    userId: result.rows[0].id,
    hasGlobalScope: hasGlobalLocationScope(result.rows[0].tipo_usuario),
  };
};

const normalizeHistoryFilters = (query = {}) => {
  const unknownFields = Object.keys(query).filter((field) => !HISTORY_QUERY_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw createHttpError(400, `Filtro no permitido: ${unknownFields[0]}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const ubicacionId = query.ubicacion_id
    ? parsePositiveInteger(query.ubicacion_id, 'El filtro ubicación es inválido')
    : undefined;
  const fechaDesde = query.fecha_desde || undefined;
  const fechaHasta = query.fecha_hasta || undefined;
  const estado = query.estado || undefined;
  if (query.autor !== undefined && typeof query.autor !== 'string') {
    throw createHttpError(400, 'autor debe ser texto');
  }
  const autor = query.autor?.trim() || undefined;

  if (fechaDesde && !isValidDateString(fechaDesde)) {
    throw createHttpError(400, 'fecha_desde debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaHasta && !isValidDateString(fechaHasta)) {
    throw createHttpError(400, 'fecha_hasta debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw createHttpError(400, 'El rango de fechas es inválido');
  }
  if (estado && !BITACORA_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser REGISTRADA o ANULADA');
  }
  if (autor && autor.length > 100) {
    throw createHttpError(400, 'autor no puede exceder 100 caracteres');
  }

  return { ubicacionId, fechaDesde, fechaHasta, estado, autor };
};

const assertLocationScope = async ({ client, userId, locationId, hasGlobalScope }) => {
  const locationResult = await client.query(
    `SELECT id, nombre, cliente_id, tipo_punto
     FROM ubicaciones
     WHERE id = $1
     FOR SHARE`,
    [locationId]
  );
  if (locationResult.rowCount === 0) {
    throw createHttpError(404, 'Ubicación no encontrada');
  }

  if (!hasGlobalScope) {
    const assignment = await findLockedUserLocationAssignment({ client, userId, locationId });
    if (!assignment) {
      throw createHttpError(403, 'No tienes acceso a la Ubicación seleccionada');
    }
  }

  return locationResult.rows[0];
};

const createRegistro = async (req, res) => {
  try {
    const created = await db.transaction(async (client) => {
      const userResult = await client.query(
        `SELECT id, usuario, tipo_usuario, colaborador_id, activo
         FROM usuarios
         WHERE id = $1
         FOR SHARE`,
        [req.user.id]
      );
      if (userResult.rowCount === 0 || !userResult.rows[0].activo) {
        throw createHttpError(403, 'El Usuario autenticado no está disponible');
      }
      const actor = userResult.rows[0];
      const hasGlobalScope = hasGlobalLocationScope(actor.tipo_usuario);
      if (!actor.colaborador_id) {
        throw createHttpError(409, 'El Usuario autenticado no tiene un Colaborador asociado');
      }

      const collaboratorResult = await client.query(
        `SELECT id
         FROM colaboradores
         WHERE id = $1
         FOR SHARE`,
        [actor.colaborador_id]
      );
      if (collaboratorResult.rowCount === 0) {
        throw createHttpError(409, 'El Colaborador asociado al Usuario no existe');
      }

      await assertLocationScope({
        client,
        userId: actor.id,
        locationId: req.body.ubicacion_id,
        hasGlobalScope,
      });

      const result = await client.query(
        `INSERT INTO bitacora_registros
          (ubicacion_id, autor_usuario_id, autor_colaborador_id, ocurrido_at, detalle)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, ubicacion_id, autor_usuario_id, autor_colaborador_id,
                   ocurrido_at, detalle, estado, created_at`,
        [
          req.body.ubicacion_id,
          actor.id,
          actor.colaborador_id,
          req.body.ocurrido_at,
          req.body.detalle,
        ]
      );
      const registro = result.rows[0];

      await logAuditStrict(client, {
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: registro.id,
        datos_nuevos: registro,
        ...auditFromReq(req),
      });

      return registro;
    });

    return res.status(201).json({
      success: true,
      message: 'Registro de Bitácora creado exitosamente',
      data: created,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al crear registro de Bitácora');
  }
};

const getRegistros = async (req, res) => {
  try {
    const pagination = normalizePaginationQuery(req.query);
    const filters = normalizeHistoryFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);

    if (filters.ubicacionId && !hasGlobalScope) {
      const scopeResult = await db.query(
        `SELECT 1
         FROM usuario_ubicaciones
         WHERE usuario_id = $1 AND ubicacion_id = $2`,
        [userId, filters.ubicacionId]
      );
      if (scopeResult.rowCount === 0) {
        throw createHttpError(403, 'No tienes acceso a la Ubicación seleccionada');
      }
    }

    const { items, total } = await findHistory({
      filters,
      hasGlobalScope,
      userId,
      pagination,
    });
    const meta = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: total,
    });

    return res.json({ success: true, data: items, meta });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar historial de Bitácora');
  }
};

const getUbicacionesVisibles = async (req, res) => {
  try {
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const data = await findVisibleLocations({
      hasGlobalScope,
      userId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar Ubicaciones de Bitácora');
  }
};

module.exports = {
  createRegistro,
  getRegistros,
  getUbicacionesVisibles,
  normalizeHistoryFilters,
  getCurrentUserScope,
};
