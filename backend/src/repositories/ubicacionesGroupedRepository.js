const db = require('../config/database');

const HISTORICAL_GROUP_NAME = 'Sin cliente — dato histórico';

const normalizeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const toBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  const error = new Error('El parámetro booleano es inválido');
  error.status = 400;
  throw error;
};

const getTotalLocations = async (executor = db) => {
  const result = await executor.query('SELECT COUNT(*)::int AS total FROM ubicaciones', []);
  return normalizeCount(result.rows?.[0]?.total);
};

const findGroupedLocationsSource = async ({ search }, executor = db) => {
  const normalizedSearch = normalizeText(search);
  const params = [];
  const searchExpression = normalizedSearch ? `%${normalizedSearch}%` : null;

  if (searchExpression) {
    params.push(searchExpression);
  }

  const clientsQuery = `
    SELECT
      c.id,
      c.nombre,
      c.estado,
      ${searchExpression ? 'c.nombre ILIKE $1' : 'FALSE'} AS cliente_search_match
    FROM clientes c
    ORDER BY
      CASE WHEN c.estado = 'activo' THEN 0 ELSE 1 END,
      c.nombre ASC,
      c.id ASC
  `;

  const locationsQuery = `
    SELECT
      u.id,
      u.nombre,
      u.tipo_punto,
      u.cliente_id,
      c.nombre AS cliente_nombre,
      c.estado AS cliente_estado,
      COUNT(DISTINCT a.id) FILTER (WHERE a.activo = TRUE)::int AS articulos_activos,
      COUNT(DISTINCT a.id)::int AS articulos_totales,
      (
        COUNT(a.id) = 0
        AND COUNT(dmo.id) = 0
        AND COUNT(dmd.id) = 0
        AND COUNT(ab.id) = 0
        AND COUNT(ise.id) = 0
      ) AS puede_eliminar,
      ${searchExpression ? 'u.nombre ILIKE $1' : 'FALSE'} AS ubicacion_search_match,
      ${searchExpression ? 'c.nombre ILIKE $1' : 'FALSE'} AS cliente_search_match
    FROM ubicaciones u
    LEFT JOIN clientes c ON c.id = u.cliente_id
    LEFT JOIN articulos a ON a.ubicacion_id = u.id
    LEFT JOIN detalle_movimientos dmo ON dmo.ubicacion_origen_id = u.id
    LEFT JOIN detalle_movimientos dmd ON dmd.ubicacion_destino_id = u.id
    LEFT JOIN articulos_bajas ab ON ab.ubicacion_id = u.id
    LEFT JOIN inventario_stock_efectos ise
      ON ise.ubicacion_anterior_id = u.id OR ise.ubicacion_posterior_id = u.id
    GROUP BY u.id, u.nombre, u.tipo_punto, u.cliente_id, c.nombre, c.estado
    ORDER BY c.nombre ASC NULLS LAST, u.nombre ASC, u.id ASC
  `;

  const [clientsResult, locationsResult] = await Promise.all([
    executor.query(clientsQuery, params),
    executor.query(locationsQuery, params),
  ]);

  return {
    clients: clientsResult.rows || [],
    locations: locationsResult.rows || [],
  };
};

const normalizeLocation = (location) => {
  const total = normalizeCount(location.articulos_totales);
  const activos = normalizeCount(location.articulos_activos);
  return {
    id: location.id,
    nombre: location.nombre,
    tipo_punto: location.tipo_punto || 'GENERAL',
    articulos_activos: activos,
    articulos_totales: total,
    estado_uso: total > 0 ? 'en_uso' : 'sin_articulos',
    puede_eliminar: Boolean(location.puede_eliminar),
    _ubicacionSearchMatch: Boolean(location.ubicacion_search_match),
    _clienteSearchMatch: Boolean(location.cliente_search_match),
  };
};

const summarizeLocations = (ubicaciones) => {
  const total = ubicaciones.length;
  const enUso = ubicaciones.filter((ubicacion) => ubicacion.estado_uso === 'en_uso').length;
  return {
    total,
    en_uso: enUso,
    disponibles: total - enUso,
  };
};

const stripInternalLocationFlags = (ubicacion) => {
  const publicLocation = { ...ubicacion };
  delete publicLocation._ubicacionSearchMatch;
  delete publicLocation._clienteSearchMatch;
  return publicLocation;
};

const buildClientGroups = ({ clients, locations, includeEmpty, search }) => {
  const normalizedSearch = normalizeText(search);
  const locationsByClient = new Map();

  locations
    .filter((location) => location.cliente_id !== null && location.cliente_id !== undefined)
    .forEach((location) => {
      const key = Number(location.cliente_id);
      const current = locationsByClient.get(key) || [];
      current.push(normalizeLocation(location));
      locationsByClient.set(key, current);
    });

  return clients
    .map((client) => {
      const allClientLocations = locationsByClient.get(Number(client.id)) || [];
      const clientMatches = Boolean(client.cliente_search_match);
      const visibleLocations = normalizedSearch
        ? clientMatches
          ? allClientLocations
          : allClientLocations.filter((location) => location._ubicacionSearchMatch)
        : allClientLocations;
      const shouldShow = includeEmpty
        ? !normalizedSearch || clientMatches || visibleLocations.length > 0
        : visibleLocations.length > 0;

      if (!shouldShow) {
        return null;
      }

      const publicLocations = visibleLocations.map(stripInternalLocationFlags);
      return {
        tipo: 'cliente',
        cliente_id: client.id,
        cliente_nombre: client.nombre,
        cliente_estado: client.estado,
        ubicaciones: publicLocations,
        resumen: summarizeLocations(publicLocations),
      };
    })
    .filter(Boolean);
};

const buildHistoricalGroup = ({ locations, includeHistorical, search }) => {
  if (!includeHistorical) {
    return null;
  }
  const normalizedSearch = normalizeText(search);
  const historicalLocations = locations
    .filter((location) => location.cliente_id === null || location.cliente_id === undefined)
    .map(normalizeLocation)
    .filter((location) => !normalizedSearch || location._ubicacionSearchMatch)
    .map(stripInternalLocationFlags);

  if (historicalLocations.length === 0) {
    return null;
  }

  return {
    tipo: 'sin_cliente',
    cliente_id: null,
    cliente_nombre: HISTORICAL_GROUP_NAME,
    cliente_estado: null,
    ubicaciones: historicalLocations,
    resumen: summarizeLocations(historicalLocations),
  };
};

const paginateGroups = (groups, pagination) => {
  const start = pagination.offset;
  const end = start + pagination.pageSize;
  return groups.slice(start, end);
};

const findGroupedLocations = async (
  { search, includeEmpty, includeHistorical, pagination },
  executor = db
) => {
  const [totalLocations, source] = await Promise.all([
    getTotalLocations(executor),
    findGroupedLocationsSource({ search }, executor),
  ]);

  const allClientGroups = buildClientGroups({
    clients: source.clients,
    locations: source.locations,
    includeEmpty,
    search: '',
  });
  const allHistoricalGroup = buildHistoricalGroup({
    locations: source.locations,
    includeHistorical,
    search: '',
  });
  const allGroups = allHistoricalGroup ? [...allClientGroups, allHistoricalGroup] : allClientGroups;
  const filteredClientGroups = buildClientGroups({
    clients: source.clients,
    locations: source.locations,
    includeEmpty,
    search,
  });
  const filteredHistoricalGroup = buildHistoricalGroup({
    locations: source.locations,
    includeHistorical,
    search,
  });
  const groups = filteredHistoricalGroup
    ? [...filteredClientGroups, filteredHistoricalGroup]
    : filteredClientGroups;
  const filteredLocations = groups.reduce((sum, group) => sum + group.resumen.total, 0);

  return {
    groups: paginateGroups(groups, pagination),
    totals: {
      totalGroups: allGroups.length,
      filteredGroups: groups.length,
      totalLocations,
      filteredLocations,
    },
  };
};

module.exports = {
  HISTORICAL_GROUP_NAME,
  buildClientGroups,
  buildHistoricalGroup,
  findGroupedLocations,
  findGroupedLocationsSource,
  summarizeLocations,
  toBoolean,
};
