const db = require('../config/database');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { isValidDateString } = require('../utils/inputValidation');
const {
  findActiveBlocksForLocation,
  findActivePrincipalResidentForVilla,
  findActiveVillasForBlock,
  findHistory,
  findLockedBlock,
  findLockedUserLocationAssignment,
  findLockedVilla,
  findVisibleBlock,
  findVisibleLocation,
  findVisibleLocations,
} = require('../repositories/bitacorasRepository');

const BITACORA_STATES = new Set(['REGISTRADA', 'ANULADA']);
const URBAN_CONTEXT_CONSTRAINTS = new Set([
  'bitacora_registros_villa_requiere_manzana_check',
  'bitacora_registros_manzana_ubicacion_fkey',
  'bitacora_registros_villa_manzana_fkey',
]);
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

const domainError = (status, code, message) => {
  const error = createHttpError(status, message);
  error.appCode = code;
  return error;
};

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

const assertLocationScope = async ({
  client,
  userId,
  locationId,
  hasGlobalScope,
  concealUnauthorized = false,
}) => {
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
      if (concealUnauthorized) {
        throw domainError(404, 'LOCATION_NOT_FOUND', 'Ubicación no encontrada');
      }
      throw createHttpError(403, 'No tienes acceso a la Ubicación seleccionada');
    }
  }

  return locationResult.rows[0];
};

const assertUrbanContext = async ({ client, location, blockId, villaId }) => {
  const hasBlock = blockId !== null && blockId !== undefined;
  const hasVilla = villaId !== null && villaId !== undefined;

  if (location.tipo_punto !== 'URBANIZACION') {
    if (hasBlock || hasVilla) {
      throw domainError(409, 'URBAN_CONTEXT_NOT_ALLOWED', 'La Ubicación no admite contexto urbano');
    }
    return;
  }

  if (!hasBlock || !hasVilla) {
    throw domainError(400, 'COMPLETE_HOUSE_REQUIRED', 'Selecciona Manzana y Villa para la Casa');
  }

  const block = await findLockedBlock({ client, blockId });
  if (!block) {
    throw domainError(404, 'BLOCK_NOT_FOUND', 'Manzana no encontrada');
  }
  if (block.estado !== 'activo') {
    throw domainError(409, 'BLOCK_INACTIVE', 'La Manzana seleccionada está inactiva');
  }
  if (block.ubicacion_id !== location.id) {
    throw domainError(409, 'INVALID_URBAN_CHAIN', 'La Manzana no pertenece a la Ubicación');
  }

  const villa = await findLockedVilla({ client, villaId });
  if (!villa) {
    throw domainError(404, 'VILLA_NOT_FOUND', 'Villa no encontrada');
  }
  if (villa.estado !== 'activo') {
    throw domainError(409, 'VILLA_INACTIVE', 'La Villa seleccionada está inactiva');
  }
  if (villa.manzana_id !== block.id) {
    throw domainError(409, 'INVALID_URBAN_CHAIN', 'La Villa no pertenece a la Manzana');
  }

  const principalResident = await findActivePrincipalResidentForVilla({ client, villaId });
  if (!principalResident) {
    throw domainError(409, 'VILLA_WITHOUT_ACTIVE_RESIDENT', 'La Villa no tiene titular activo');
  }
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

      const location = await assertLocationScope({
        client,
        userId: actor.id,
        locationId: req.body.ubicacion_id,
        hasGlobalScope,
      });

      await assertUrbanContext({
        client,
        location,
        blockId: req.body.manzana_id ?? null,
        villaId: req.body.villa_id ?? null,
      });

      const result = await client.query(
        `INSERT INTO bitacora_registros
          (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
           ocurrido_at, detalle)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
                   ocurrido_at, detalle, estado, created_at`,
        [
          req.body.ubicacion_id,
          req.body.manzana_id ?? null,
          req.body.villa_id ?? null,
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
    if (URBAN_CONTEXT_CONSTRAINTS.has(error.constraint)) {
      error.status = 409;
      error.appCode = 'INVALID_URBAN_CHAIN';
      error.message = 'El contexto urbano dejó de ser válido';
    }
    return handleControllerError(res, error, 'Error al crear registro de Bitácora');
  }
};

const getManzanasElegibles = async (req, res) => {
  try {
    const locationId = parsePositiveInteger(req.params.ubicacionId, 'La Ubicación es inválida');
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const visibleLocation = await findVisibleLocation({ locationId, hasGlobalScope, userId });
    if (!visibleLocation) {
      throw domainError(404, 'LOCATION_NOT_FOUND', 'Ubicación no encontrada');
    }
    const data = await db.transaction(async (client) => {
      const location = await assertLocationScope({
        client,
        userId,
        locationId,
        hasGlobalScope,
        concealUnauthorized: true,
      });
      return location.tipo_punto === 'URBANIZACION'
        ? findActiveBlocksForLocation({ locationId, executor: client })
        : [];
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar Manzanas de Bitácora');
  }
};

const getVillasElegibles = async (req, res) => {
  try {
    const blockId = parsePositiveInteger(req.params.manzanaId, 'La Manzana es inválida');
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const existingBlock = await findVisibleBlock({ blockId, hasGlobalScope, userId });
    if (!existingBlock) {
      throw domainError(404, 'BLOCK_NOT_FOUND', 'Manzana no encontrada');
    }
    const data = await db.transaction(async (client) => {
      const location = await assertLocationScope({
        client,
        userId,
        locationId: existingBlock.ubicacion_id,
        hasGlobalScope,
        concealUnauthorized: true,
      });
      const block = await findLockedBlock({ client, blockId });
      if (!block || block.ubicacion_id !== location.id) {
        throw domainError(409, 'INVALID_URBAN_CHAIN', 'La Manzana dejó de estar disponible');
      }
      if (location.tipo_punto !== 'URBANIZACION' || block.estado !== 'activo') {
        throw domainError(409, 'BLOCK_INACTIVE', 'La Manzana no está disponible');
      }
      return findActiveVillasForBlock({ blockId, executor: client });
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar Villas de Bitácora');
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
  getManzanasElegibles,
  getVillasElegibles,
};
