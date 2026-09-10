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

const buildBajasArticulosQuery = ({ search, from, to, pagination }) => {
  const params = [];
  const conditions = [];
  let query = `SELECT
      b.id,
      b.articulo_id,
      b.cantidad,
      b.motivo,
      b.fecha_baja,
      b.tipo_articulo,
      b.nombre_articulo,
      b.talla,
      b.marca,
      b.modelo,
      b.numero_serie,
      b.calibre,
      b.codigo_pantalla,
      b.codigo_radio,
      b.version,
      b.ubicacion_id,
      b.ubicacion_nombre,
      b.estado,
      b.anulado_por,
      b.anulado_en,
      b.motivo_anulacion,
      u.usuario${pagination ? ', COUNT(*) OVER()::int AS total_count' : ''}
    FROM articulos_bajas b
    LEFT JOIN usuarios u ON u.id = b.usuario_id`;

  // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
  conditions.push("COALESCE(b.estado, 'ACTIVO') <> 'ELIMINADO'");

  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(`(
      b.nombre_articulo ILIKE $${params.length} OR
      b.numero_serie ILIKE $${params.length} OR
      b.codigo_radio ILIKE $${params.length} OR
      b.marca ILIKE $${params.length} OR
      b.modelo ILIKE $${params.length} OR
      b.calibre ILIKE $${params.length} OR
      b.codigo_pantalla ILIKE $${params.length} OR
      b.version ILIKE $${params.length} OR
      b.ubicacion_nombre ILIKE $${params.length} OR
      b.motivo ILIKE $${params.length} OR
      u.usuario ILIKE $${params.length}
    )`);
  }

  if (from) {
    params.push(from);
    conditions.push(`b.fecha_baja::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`b.fecha_baja::date <= $${params.length}::date`);
  }

  query += ` WHERE ${conditions.join(' AND ')}`;

  query += ' ORDER BY b.fecha_baja DESC, b.id DESC';
  if (pagination) {
    params.push(pagination.pageSize, pagination.offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }
  return { query, params };
};

const findBajasArticulos = ({ search, from, to, pagination }, executor = db) => {
  const { query, params } = buildBajasArticulosQuery({ search, from, to, pagination });
  return executor.query(query, params);
};

const buildMovimientosReporteQuery = ({ from, to, destino_id }) => {
  const params = [];
  const conditions = [];

  if (from) {
    params.push(from);
    conditions.push(`m.fecha_movimiento::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`m.fecha_movimiento::date <= $${params.length}::date`);
  }

  if (destino_id) {
    params.push(parsePositiveInteger(destino_id, 'El filtro destino es inválido'));
    conditions.push(`d.ubicacion_destino_id = $${params.length}`);
  }

  // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
  conditions.push("COALESCE(m.estado, 'ACTIVO') <> 'ELIMINADO'");

  const where = `WHERE ${conditions.join(' AND ')}`;

  return {
    params,
    query: `
      SELECT
        m.id,
        m.fecha_movimiento,
        m.estado,
        m.anulado_en,
        m.motivo_anulacion,
        u.usuario,
        COALESCE(SUM(d.cantidad), 0)::INT AS items,
        STRING_AGG(
          DISTINCT COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo'),
          ', '
          ORDER BY COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
        ) AS articulos_movidos,
        STRING_AGG(DISTINCT ao.nombre, ', ' ORDER BY ao.nombre) AS ubicacion_origen,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(ad.nombre)
          ELSE NULL
        END AS ubicacion_destino
      FROM movimientos m
      LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
      LEFT JOIN articulos a ON d.articulo_id = a.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
      LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
      ${where}
      GROUP BY m.id, u.usuario
      ORDER BY m.fecha_movimiento DESC`,
  };
};

const findMovimientosForExport = ({ from, to, destino_id }, executor = db) => {
  const { query, params } = buildMovimientosReporteQuery({ from, to, destino_id });
  return executor.query(query, params);
};

const findMovimientoDetalleForPdf = async (movimientoId, executor = db) => {
  const result = await executor.query(
    `SELECT
      m.id,
      m.fecha_movimiento,
      u.usuario,
      d.cantidad,
      a.tipo_articulo,
      a.nombre_articulo,
      a.numero_serie,
      a.codigo_radio,
      a.marca,
      a.modelo,
      a.calibre,
      ao.nombre AS ubicacion_origen,
      ad.nombre AS ubicacion_destino
    FROM movimientos m
    JOIN usuarios u ON m.usuario_id = u.id
    JOIN detalle_movimientos d ON d.movimiento_id = m.id
    JOIN articulos a ON d.articulo_id = a.id
    LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
    LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
    WHERE m.id = $1
    ORDER BY d.id ASC`,
    [movimientoId]
  );

  return result.rows;
};

const findUbicacionesSimple = (executor = db) =>
  executor.query('SELECT id, nombre FROM ubicaciones ORDER BY nombre ASC');

const findMovimientoPdfPath = (id, executor = db) =>
  executor.query('SELECT pdf_path FROM movimientos WHERE id = $1', [id]);

const movimientoExists = (id, executor = db) =>
  executor.query('SELECT id FROM movimientos WHERE id = $1', [id]);

module.exports = {
  buildInventarioAlertasQuery,
  buildMovimientosListQuery,
  buildBajasArticulosQuery,
  buildMovimientosReporteQuery,
  findArticulos,
  findArticulosCatalogo,
  findArticulosForExport,
  findMovimientos,
  findBajasArticulos,
  findMovimientosForExport,
  findMovimientoDetalleForPdf,
  findUbicacionesSimple,
  findMovimientoPdfPath,
  movimientoExists,
};
