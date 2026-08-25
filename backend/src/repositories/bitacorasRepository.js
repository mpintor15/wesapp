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
     ${where}
     ORDER BY br.ocurrido_at DESC, br.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );

  return { items: dataResult.rows, total: countResult.rows[0]?.total || 0 };
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
  findLockedUserLocationAssignment,
  findHistory,
  findVisibleLocations,
};
