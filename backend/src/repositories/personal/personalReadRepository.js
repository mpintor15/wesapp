const db = require('../../config/database');

// LEFT JOIN 1:1 con usuarios (usuarios.colaborador_id es UNIQUE), así que
// nunca duplica filas de colaboradores: cada colaborador aporta a lo sumo
// un usuario asociado.
const COLABORADORES_FROM = `
  FROM colaboradores c
  LEFT JOIN usuarios u ON u.colaborador_id = c.id
`;

const COLABORADORES_JOIN_COLUMNS = `
    u.id AS usuario_id,
    u.usuario AS usuario_usuario,
    u.tipo_usuario AS usuario_tipo_usuario,
    u.activo AS usuario_activo,
    u.primer_login AS usuario_primer_login
`;

const buildColaboradoresWhere = ({ search, estado, cargo } = {}) => {
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      c.nombres_completos ILIKE $${params.length}
      OR c.cedula ILIKE $${params.length}
      OR c.celular ILIKE $${params.length}
      OR c.numero_cuenta ILIKE $${params.length}
    )`);
  }

  if (estado) {
    params.push(estado);
    conditions.push(`c.estado = $${params.length}`);
  }

  if (cargo) {
    params.push(cargo);
    conditions.push(`c.cargo ILIKE $${params.length}`);
  }

  const clause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
};

// Se conserva por compatibilidad con quien construya la query manualmente
// (p.ej. tests existentes que inspeccionan el SQL generado).
const buildColaboradoresQuery = (filters) => {
  const { clause, params } = buildColaboradoresWhere(filters);
  const query = `SELECT c.*,${COLABORADORES_JOIN_COLUMNS}${COLABORADORES_FROM}${clause} ORDER BY c.nombres_completos ASC, c.id ASC`;
  return { query, params };
};

const findColaboradores = (filters, pagination, executor = db) => {
  const { clause, params } = buildColaboradoresWhere(filters);
  const paginatedParams = [...params, pagination.pageSize, pagination.offset];
  const query = `
    SELECT
      COUNT(*) OVER()::int AS total_count,
      c.*,${COLABORADORES_JOIN_COLUMNS}${COLABORADORES_FROM}${clause}
    ORDER BY c.nombres_completos ASC, c.id ASC
    LIMIT $${paginatedParams.length - 1} OFFSET $${paginatedParams.length}
  `;
  return executor.query(query, paginatedParams);
};

const findColaboradoresForExport = (filters, executor = db) => {
  const { query, params } = buildColaboradoresQuery(filters);
  return executor.query(query, params);
};

module.exports = {
  buildColaboradoresQuery,
  findColaboradores,
  findColaboradoresForExport,
};
