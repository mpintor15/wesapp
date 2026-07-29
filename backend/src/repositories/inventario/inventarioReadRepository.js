const db = require('../../config/database');
const { parsePositiveInteger } = require('../../utils/http');

const buildInventarioAlertasQuery = ({ tipo, ubicacion_id, estado, search }) => {
  const params = [];
  const conditions = [];

  if (tipo) {
    params.push(tipo);
    conditions.push(`tipo_articulo = $${params.length}`);
  }

  if (ubicacion_id) {
    params.push(parsePositiveInteger(ubicacion_id, 'El filtro ubicación es inválido'));
    conditions.push(`ubicacion_id = $${params.length}`);
  }

  if (estado) {
    params.push(estado);
    conditions.push(`estado_caducidad = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      nombre_articulo ILIKE $${params.length} OR
      numero_serie ILIKE $${params.length} OR
      marca ILIKE $${params.length} OR
      modelo ILIKE $${params.length} OR
      calibre ILIKE $${params.length} OR
      codigo_pantalla ILIKE $${params.length} OR
      codigo_radio ILIKE $${params.length} OR
      version ILIKE $${params.length}
    )`);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

const getInventarioAlertasListQuery = ({ pagination, filters }) => {
  const { where, params } = buildInventarioAlertasQuery(filters);
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;
  return {
    countQuery: `SELECT COUNT(*)::int AS total FROM vista_inventario_alertas${where}`,
    dataQuery: `SELECT * FROM vista_inventario_alertas${where}
      ORDER BY ${pagination.sortExpression} ${pagination.sortOrder.toUpperCase()}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    countParams: params,
    dataParams,
  };
};

const buildMovimientosBaseQuery = () => `SELECT
    m.id,
    m.fecha_movimiento,
    m.pdf_path,
    m.estado,
    m.anulado_por,
    m.anulado_en,
    m.motivo_anulacion,
    (
      COALESCE(m.estado, 'ACTIVO') = 'ACTIVO'
      AND COALESCE(m.reversion_datos_completos, FALSE) = TRUE
      AND EXISTS (
        SELECT 1
        FROM inventario_stock_efectos e
        WHERE e.movimiento_id = m.id
      )
    ) AS reversible,
    CASE
      WHEN COALESCE(m.estado, 'ACTIVO') = 'ANULADO' THEN 'ALREADY_VOIDED'
      WHEN COALESCE(m.estado, 'ACTIVO') = 'ELIMINADO' THEN 'ADMINISTRATIVELY_DELETED'
      WHEN COALESCE(m.reversion_datos_completos, FALSE) = TRUE
        AND EXISTS (
          SELECT 1
          FROM inventario_stock_efectos e
          WHERE e.movimiento_id = m.id
        ) THEN 'COMPLETE'
      ELSE 'INCOMPLETE'
    END AS reversal_status,
    u.usuario,
    COALESCE(SUM(d.cantidad), 0)::INT AS items,
    STRING_AGG(
      DISTINCT COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
      , ', '
      ORDER BY COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
    ) AS articulos_movidos,
    CASE
      WHEN BOOL_AND(d.ubicacion_origen_id IS NULL) THEN 'entrada'
      WHEN BOOL_AND(d.ubicacion_destino_id IS NULL) THEN 'salida'
      ELSE 'traslado'
    END AS tipo_movimiento,
    STRING_AGG(DISTINCT ao.nombre, ', ' ORDER BY ao.nombre) AS ubicacion_origen,
    CASE
      WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(ad.nombre)
      ELSE NULL
    END AS ubicacion_destino,
    CASE
      WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(d.ubicacion_destino_id)
      ELSE NULL
    END AS ubicacion_destino_id
  FROM movimientos m
  LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
  LEFT JOIN articulos a ON d.articulo_id = a.id
  LEFT JOIN usuarios u ON m.usuario_id = u.id
  LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
  LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
  WHERE COALESCE(m.estado, 'ACTIVO') <> 'ELIMINADO'
  GROUP BY m.id, u.usuario`;

const buildMovimientosListQuery = ({ search, destino_id, from, to, pagination }) => {
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(`(
      articulos_movidos ILIKE $${params.length} OR
      ubicacion_origen ILIKE $${params.length} OR
      usuario ILIKE $${params.length}
    )`);
  }

  if (destino_id) {
    params.push(parsePositiveInteger(destino_id, 'El filtro destino es inválido'));
    conditions.push(`ubicacion_destino_id = $${params.length}`);
  }

  if (from) {
    params.push(from);
    conditions.push(`fecha_movimiento::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`fecha_movimiento::date <= $${params.length}::date`);
  }

  const base = `FROM (${buildMovimientosBaseQuery()}) movimientos_list`;
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;

  return {
    countQuery: `SELECT COUNT(*)::int AS total ${base}${where}`,
    dataQuery: `SELECT * ${base}${where}
      ORDER BY ${pagination.sortExpression} ${pagination.sortOrder.toUpperCase()}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    countParams: params,
    dataParams,
  };
};

const findArticulos = async ({ filters, pagination }, executor = db) => {
  const { countQuery, dataQuery, countParams, dataParams } = getInventarioAlertasListQuery({
    filters,
    pagination,
  });
  const [countResult, result] = await Promise.all([
    executor.query(countQuery, countParams),
    executor.query(dataQuery, dataParams),
  ]);
  return { countResult, result };
};

const findArticulosCatalogo = (executor = db) =>
  executor.query('SELECT * FROM vista_inventario_alertas ORDER BY nombre_articulo ASC, id ASC', []);

const findArticulosForExport = (filters, executor = db) => {
  const { where, params } = buildInventarioAlertasQuery(filters);
  return executor.query(
    `SELECT * FROM vista_inventario_alertas${where} ORDER BY created_at DESC`,
    params
  );
};

const findMovimientos = async ({ search, destino_id, from, to, pagination }, executor = db) => {
  const { countQuery, dataQuery, countParams, dataParams } = buildMovimientosListQuery({
    search,
    destino_id,
    from,
    to,
    pagination,
  });
  const [countResult, result] = await Promise.all([
    executor.query(countQuery, countParams),
    executor.query(dataQuery, dataParams),
  ]);
  return { countResult, result };
};

module.exports = {
  buildInventarioAlertasQuery,
  buildMovimientosListQuery,
  findArticulos,
  findArticulosCatalogo,
  findArticulosForExport,
  findMovimientos,
};
