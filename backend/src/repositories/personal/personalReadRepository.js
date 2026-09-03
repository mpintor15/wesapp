const db = require('../../config/database');

const buildColaboradoresQuery = ({ search, estado, cargo } = {}) => {
  let query = 'SELECT * FROM colaboradores';
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      nombres_completos ILIKE $${params.length}
      OR cedula ILIKE $${params.length}
      OR celular ILIKE $${params.length}
      OR numero_cuenta ILIKE $${params.length}
    )`);
  }

  if (estado) {
    params.push(estado);
    conditions.push(`estado = $${params.length}`);
  }

  if (cargo) {
    params.push(cargo);
    conditions.push(`cargo ILIKE $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY nombres_completos ASC, id ASC';
  return { query, params };
};

const findColaboradores = (filters, pagination, executor = db) => {
  const { query, params } = buildColaboradoresQuery(filters);
  const paginatedQuery = query.replace('SELECT *', 'SELECT *, COUNT(*) OVER()::int AS total_count');
  const paginatedParams = [...params, pagination.pageSize, pagination.offset];
  return executor.query(
    `${paginatedQuery} LIMIT $${paginatedParams.length - 1} OFFSET $${paginatedParams.length}`,
    paginatedParams
  );
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
