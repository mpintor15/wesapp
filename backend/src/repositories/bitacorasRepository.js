const db = require('../config/database');

const findLockedUserLocationAssignment = async ({ client, userId, locationId }) => {
  const result = await client.query(
    `SELECT usuario_id, ubicacion_id
     FROM usuario_ubicaciones
     WHERE usuario_id = $1 AND ubicacion_id = $2
     FOR KEY SHARE`,
    [userId, locationId]
  );
  return result.rows[0] || null;
};

const findLockedBlock = async ({ client, blockId }) => {
  const result = await client.query(
    `SELECT id, ubicacion_id, nombre, estado
     FROM manzanas
     WHERE id = $1
     FOR SHARE`,
    [blockId]
  );
  return result.rows[0] || null;
};

const findVisibleBlock = async ({ blockId, hasGlobalScope, userId, executor = db }) => {
  const params = [blockId];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'm.ubicacion_id',
  });
  const result = await executor.query(
    `SELECT m.id, m.ubicacion_id, m.nombre, m.estado
     FROM manzanas m
     WHERE m.id = $1${scopeCondition ? ` AND ${scopeCondition}` : ''}`,
    params
  );
  return result.rows[0] || null;
};

const findVisibleLocation = async ({ locationId, hasGlobalScope, userId, executor = db }) => {
  const params = [locationId];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'u.id',
  });
  const result = await executor.query(
    `SELECT u.id, u.nombre, u.cliente_id, u.tipo_punto
     FROM ubicaciones u
     WHERE u.id = $1${scopeCondition ? ` AND ${scopeCondition}` : ''}`,
    params
  );
  return result.rows[0] || null;
};

const findLockedVilla = async ({ client, villaId }) => {
  const result = await client.query(
    `SELECT id, manzana_id, identificador, estado
     FROM villas
     WHERE id = $1
     FOR SHARE`,
    [villaId]
  );
  return result.rows[0] || null;
};

const buildScopeCondition = ({
  hasGlobalScope,
  userId,
  params,
  locationExpression = 'br.ubicacion_id',
}) => {
  if (hasGlobalScope) {
    return undefined;
  }

  params.push(userId);
  return `EXISTS (
    SELECT 1
    FROM usuario_ubicaciones uu
    WHERE uu.usuario_id = $${params.length}
      AND uu.ubicacion_id = ${locationExpression}
  )`;
};

const buildHistoryFilters = ({ filters, hasGlobalScope, userId }) => {
  const params = [];
  const conditions = [];
  const scopeCondition = buildScopeCondition({ hasGlobalScope, userId, params });

  if (scopeCondition) {
    conditions.push(scopeCondition);
  }
  if (filters.ubicacionId) {
    params.push(filters.ubicacionId);
    conditions.push(`br.ubicacion_id = $${params.length}`);
  }
  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    conditions.push(`br.ocurrido_at >= $${params.length}::date`);
  }
  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    conditions.push(`br.ocurrido_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.estado) {
    params.push(filters.estado);
    conditions.push(`br.estado = $${params.length}`);
  }
  if (filters.autor) {
    params.push(`%${filters.autor}%`);
    conditions.push(`(
      EXISTS (
        SELECT 1
        FROM colaboradores autor_c
        WHERE autor_c.id = br.autor_colaborador_id
          AND autor_c.nombres_completos ILIKE $${params.length}
      )
      OR EXISTS (
        SELECT 1
        FROM usuarios autor_u
        WHERE autor_u.id = br.autor_usuario_id
          AND autor_u.usuario ILIKE $${params.length}
      )
    )`);
  }

  return {
    params,
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
  };
};

const findHistory = async ({ filters, hasGlobalScope, userId, pagination, executor = db }) => {
  const { params, where } = buildHistoryFilters({ filters, hasGlobalScope, userId });
  const countResult = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM bitacora_registros br
     ${where}`,
    params
  );
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;
  const dataResult = await executor.query(
    `SELECT
       br.id,
       br.ubicacion_id,
       u.nombre AS ubicacion_nombre,
       u.tipo_punto,
       br.manzana_id,
       m.nombre AS manzana_nombre,
       br.villa_id,
       v.identificador AS villa_identificador,
       br.autor_usuario_id,
       au.usuario AS autor_usuario,
       br.autor_colaborador_id,
       c.nombres_completos AS autor_colaborador_nombre,
       br.ocurrido_at,
       br.detalle,
       br.estado,
       br.created_at,
       br.anulado_at,
       br.anulado_por_usuario_id,
       br.motivo_anulacion
     FROM bitacora_registros br
     INNER JOIN ubicaciones u ON u.id = br.ubicacion_id
     INNER JOIN usuarios au ON au.id = br.autor_usuario_id
     INNER JOIN colaboradores c ON c.id = br.autor_colaborador_id
     LEFT JOIN manzanas m ON m.id = br.manzana_id
     LEFT JOIN villas v ON v.id = br.villa_id
     ${where}
     ORDER BY br.ocurrido_at DESC, br.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );

  return { items: dataResult.rows, total: countResult.rows[0]?.total || 0 };
};

const findActiveBlocksForLocation = async ({ locationId, executor = db }) => {
  const result = await executor.query(
    `SELECT id, ubicacion_id, nombre
     FROM manzanas
     WHERE ubicacion_id = $1 AND estado = 'activo'
     ORDER BY nombre ASC, id ASC`,
    [locationId]
  );
  return result.rows;
};

const findActiveVillasForBlock = async ({ blockId, executor = db }) => {
  const result = await executor.query(
    `SELECT id, manzana_id, identificador
     FROM villas
     WHERE manzana_id = $1 AND estado = 'activo'
     ORDER BY identificador ASC, id ASC`,
    [blockId]
  );
  return result.rows;
};

const findVisibleLocations = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const conditions = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'u.id',
  });
  if (scopeCondition) {
    conditions.push(scopeCondition);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await executor.query(
    `SELECT u.id, u.nombre, u.cliente_id, c.nombre AS cliente_nombre, u.tipo_punto
     FROM ubicaciones u
     LEFT JOIN clientes c ON c.id = u.cliente_id
     ${where}
     ORDER BY c.nombre ASC NULLS LAST, u.nombre ASC, u.id ASC`,
    params
  );
  return result.rows;
};

module.exports = {
  buildHistoryFilters,
  findActiveBlocksForLocation,
  findActiveVillasForBlock,
  findVisibleBlock,
  findVisibleLocation,
  findLockedBlock,
  findLockedVilla,
  findLockedUserLocationAssignment,
  findHistory,
  findVisibleLocations,
};
