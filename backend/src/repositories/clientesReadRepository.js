const db = require('../config/database');

const buildClientesFilters = ({ search, estado, estadoUbicaciones, ubicacionId }) => {
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
  return { where, params };
};

const findClientes = ({ filters, pagination }, executor = db) => {
  const { where, params } = buildClientesFilters(filters);
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  return executor.query(
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
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );
};

const findClientesTotals = (executor = db) =>
  executor.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE estado = 'activo')::int AS activos,
       COUNT(*) FILTER (WHERE estado = 'inactivo')::int AS inactivos
     FROM clientes`
  );

const findClientesOpciones = (executor = db) =>
  executor.query(
    `SELECT id, nombre, estado
     FROM clientes
     WHERE estado = $1
     ORDER BY nombre ASC, id ASC`,
    ['activo']
  );

const findClienteById = (id, executor = db) =>
  executor.query(
    `SELECT id, nombre, identificacion, tipo_identificacion, telefono, correo,
            direccion, ciudad, estado, created_at, updated_at
     FROM clientes
     WHERE id = $1`,
    [id]
  );

module.exports = {
  buildClientesFilters,
  findClientes,
  findClientesTotals,
  findClientesOpciones,
  findClienteById,
};
