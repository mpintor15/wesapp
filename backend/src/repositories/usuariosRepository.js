const db = require('../config/database');

const findUsuarioSummaryById = async (id, executor = db) => {
  const result = await executor.query(
    'SELECT id, tipo_usuario, activo, colaborador_id FROM usuarios WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
};

const countActiveGerentes = async (roleGerente, executor = db) => {
  const result = await executor.query(
    'SELECT COUNT(*)::int AS total FROM usuarios WHERE tipo_usuario = $1 AND activo = TRUE',
    [roleGerente]
  );
  return Number(result.rows[0]?.total || 0);
};

const buildUsuariosFilters = ({ search, tipoUsuario, colaboradorId, activo }) => {
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(u.usuario ILIKE $${params.length} OR u.nombre ILIKE $${params.length} OR u.apellido ILIKE $${params.length})`
    );
  }

  if (tipoUsuario) {
    params.push(tipoUsuario);
    conditions.push(`u.tipo_usuario = $${params.length}`);
  }

  if (colaboradorId !== undefined) {
    params.push(colaboradorId);
    conditions.push(`u.colaborador_id = $${params.length}`);
  }

  if (activo === 'pendiente' || activo === 'pending') {
    conditions.push('u.primer_login = TRUE');
  } else if (activo === 'true') {
    params.push(true);
    conditions.push(`u.activo = $${params.length} AND u.primer_login = FALSE`);
  } else if (activo === 'false') {
    params.push(false);
    conditions.push(`u.activo = $${params.length}`);
  }

  return { params, conditions };
};

const findUsuarios = ({ filters, pagination }, executor = db) => {
  const { params, conditions } = buildUsuariosFilters(filters);
  let query = `
      SELECT u.id, u.usuario, u.nombre, u.apellido, u.tipo_usuario, u.primer_login, u.activo,
             u.created_at, u.colaborador_id, c.nombres_completos AS colaborador_nombre,
             c.estado AS colaborador_estado,
             COALESCE(ARRAY_AGG(uu.ubicacion_id) FILTER (WHERE uu.ubicacion_id IS NOT NULL), '{}') AS ubicacion_ids
      FROM usuarios u
      LEFT JOIN colaboradores c ON c.id = u.colaborador_id
      LEFT JOIN usuario_ubicaciones uu ON uu.usuario_id = u.id
    `;

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' GROUP BY u.id, c.nombres_completos, c.estado';

  const dataParams = [...params, pagination.pageSize, pagination.offset];
  query = `SELECT filtered.*, COUNT(*) OVER()::int AS total_count
      FROM (${query}) filtered
      ORDER BY filtered.apellido ASC, filtered.nombre ASC, filtered.usuario ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

  return executor.query(query, dataParams);
};

const findUbicacionesAsignables = (executor = db) =>
  executor.query(
    `SELECT u.id, u.nombre, c.direccion, u.cliente_id, c.nombre AS cliente_nombre
     FROM ubicaciones u LEFT JOIN clientes c ON c.id = u.cliente_id
     ORDER BY COALESCE(c.nombre, ''), u.nombre`
  );

const findColaboradoresElegibles = (usuarioId, executor = db) =>
  executor.query(
    `SELECT c.id, c.nombres_completos, c.cedula, c.cargo, c.estado
     FROM colaboradores c
     LEFT JOIN usuarios u ON u.colaborador_id = c.id
     WHERE (c.estado = 'activo' AND u.id IS NULL)
        OR ($1::integer IS NOT NULL AND u.id = $1)
     ORDER BY c.nombres_completos ASC`,
    [usuarioId]
  );

const findUsuarioParaReenvio = async (id, executor = db) => {
  const result = await executor.query(
    `SELECT id, usuario, nombre, apellido, tipo_usuario, primer_login, activo
     FROM usuarios
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
};

const updatePasswordReenvio = (id, passwordHash, executor = db) =>
  executor.query(
    `UPDATE usuarios
     SET password_hash = $1, primer_login = TRUE
     WHERE id = $2
     RETURNING id, usuario, nombre, apellido, tipo_usuario, primer_login, activo`,
    [passwordHash, id]
  );

module.exports = {
  findUsuarioSummaryById,
  countActiveGerentes,
  buildUsuariosFilters,
  findUsuarios,
  findUbicacionesAsignables,
  findColaboradoresElegibles,
  findUsuarioParaReenvio,
  updatePasswordReenvio,
};
