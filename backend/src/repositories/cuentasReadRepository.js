const db = require('../config/database');

const _schemaCache = {};

const tableColumnExists = async (tableName, columnName, executor = db) => {
  const key = `${tableName}.${columnName}`;
  if (key in _schemaCache) {
    return _schemaCache[key];
  }
  const result = await executor.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  _schemaCache[key] = result.rowCount > 0;
  return _schemaCache[key];
};

const tableExists = async (tableName, executor = db) => {
  const key = `table::${tableName}`;
  if (key in _schemaCache) {
    return _schemaCache[key];
  }
  const result = await executor.query('SELECT to_regclass($1) AS table_name', [
    `public.${tableName}`,
  ]);
  _schemaCache[key] = Boolean(result.rows[0]?.table_name);
  return _schemaCache[key];
};

const getCuentasReadSchema = async (executor = db) => {
  const pagosTableExists = await tableExists('pagos', executor);
  const [
    abonosHasPagoId,
    pagosHasClienteId,
    pagosHasFecha,
    pagosHasMetodoPago,
    pagosHasReferencia,
    pagosHasNotas,
    pagosHasTotal,
    pagosHasCreatedAt,
    cuentasHasCancelada,
    cuentasHasIncluyeIva,
    cuentasHasIncluyeRetencionFuente,
    cuentasHasIncluyeRetencionIva,
    cuentasHasDetalleAnulacion,
    cuentasHasFechaAnulacion,
  ] = await Promise.all([
    tableColumnExists('abonos', 'pago_id', executor),
    pagosTableExists ? tableColumnExists('pagos', 'cliente_id', executor) : Promise.resolve(false),
    pagosTableExists ? tableColumnExists('pagos', 'fecha', executor) : Promise.resolve(false),
    pagosTableExists ? tableColumnExists('pagos', 'metodo_pago', executor) : Promise.resolve(false),
    pagosTableExists ? tableColumnExists('pagos', 'referencia', executor) : Promise.resolve(false),
    pagosTableExists ? tableColumnExists('pagos', 'notas', executor) : Promise.resolve(false),
    pagosTableExists ? tableColumnExists('pagos', 'total', executor) : Promise.resolve(false),
    pagosTableExists ? tableColumnExists('pagos', 'created_at', executor) : Promise.resolve(false),
    tableColumnExists('cuentas', 'cancelada', executor),
    tableColumnExists('cuentas', 'incluye_iva', executor),
    tableColumnExists('cuentas', 'incluye_retencion_fuente', executor),
    tableColumnExists('cuentas', 'incluye_retencion_iva', executor),
    tableColumnExists('cuentas', 'detalle_anulacion', executor),
    tableColumnExists('cuentas', 'fecha_anulacion', executor),
  ]);

  return {
    pagosTableExists,
    abonosHasPagoId,
    pagosHasClienteId,
    pagosHasFecha,
    pagosHasMetodoPago,
    pagosHasReferencia,
    pagosHasNotas,
    pagosHasTotal,
    pagosHasCreatedAt,
    cuentasHasCancelada,
    cuentasHasIncluyeIva,
    cuentasHasIncluyeRetencionFuente,
    cuentasHasIncluyeRetencionIva,
    cuentasHasDetalleAnulacion,
    cuentasHasFechaAnulacion,
  };
};

const applyPaginationToQuery = ({ baseQuery, conditions, params, pagination, orderByClause }) => {
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;
  const orderBy =
    orderByClause || `ORDER BY ${pagination.sortExpression} ${pagination.sortOrder.toUpperCase()}`;

  return {
    countQuery: `SELECT COUNT(*)::int AS total FROM (${baseQuery}) paginated_source${where}`,
    dataQuery: `SELECT * FROM (${baseQuery}) paginated_source${where}
      ${orderBy}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    countParams: params,
    dataParams,
  };
};

const buildPagosFilters = ({ fecha_inicio, fecha_fin, metodo_pago, search } = {}) => {
  const conditions = [];
  const params = [];

  if (fecha_inicio && fecha_fin) {
    params.push(fecha_inicio, fecha_fin);
    conditions.push(`fecha BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (metodo_pago) {
    params.push(metodo_pago);
    conditions.push(`LOWER(COALESCE(metodo_pago, '')) = $${params.length}`);
  }
  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(`(cliente ILIKE $${params.length} OR total::text ILIKE $${params.length})`);
  }

  return { conditions, params };
};

const buildLegacyPagosBaseQuery = (schema) => `WITH totales_abonos AS (
           SELECT num_factura, SUM(valor_abono) AS total_abonos
           FROM abonos
           GROUP BY num_factura
         )
         SELECT
           a.id,
           a.fecha_abono AS fecha,
           NULL::varchar AS metodo_pago,
           NULL::varchar AS referencia,
           NULL::text AS notas,
           a.valor_abono AS total,
           a.created_at,
           cl.id AS cliente_id,
           cl.nombre AS cliente,
           cl.identificacion,
           1::int AS facturas_count,
           JSON_BUILD_ARRAY(
             JSON_BUILD_OBJECT(
               'abono_id', a.id,
               'num_factura', a.num_factura,
               'fecha_factura', c.fecha_factura,
               'valor_factura', c.valor_factura,
               'valor_abono', a.valor_abono,
               'cancelada', ${schema.cuentasHasCancelada ? 'c.cancelada' : 'FALSE'},
               'saldo_pendiente',
                 CASE
                   WHEN ${schema.cuentasHasCancelada ? 'COALESCE(c.cancelada, FALSE)' : 'FALSE'} THEN 0
                   ELSE (
                     c.valor_factura
                     + CASE WHEN ${schema.cuentasHasIncluyeIva ? 'COALESCE(c.incluye_iva, FALSE)' : 'FALSE'} THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
                     - CASE WHEN ${schema.cuentasHasIncluyeRetencionFuente ? 'COALESCE(c.incluye_retencion_fuente, FALSE)' : 'FALSE'} THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
                     - CASE WHEN ${schema.cuentasHasIncluyeRetencionIva ? 'COALESCE(c.incluye_retencion_iva, FALSE)' : 'FALSE'} AND ${schema.cuentasHasIncluyeIva ? 'COALESCE(c.incluye_iva, FALSE)' : 'FALSE'} THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
                     - COALESCE(ta.total_abonos, 0)
                   )
                 END
             )
           ) AS facturas
         FROM abonos a
         JOIN cuentas c ON c.num_factura = a.num_factura
         JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN totales_abonos ta ON ta.num_factura = c.num_factura`;

const buildPagosBaseQuery = (schema) => {
  if (!schema.pagosTableExists || !schema.abonosHasPagoId) {
    return buildLegacyPagosBaseQuery(schema);
  }

  const pagoFechaSelect = schema.pagosHasFecha ? 'p.fecha' : 'MIN(a.fecha_abono)';
  const pagoCreatedAtSelect = schema.pagosHasCreatedAt ? 'p.created_at' : pagoFechaSelect;
  const pagoMetodoSelect = schema.pagosHasMetodoPago ? 'p.metodo_pago' : 'NULL::varchar';
  const pagoReferenciaSelect = schema.pagosHasReferencia ? 'p.referencia' : 'NULL::varchar';
  const pagoNotasSelect = schema.pagosHasNotas ? 'p.notas' : 'NULL::text';
  const pagoTotalSelect = schema.pagosHasTotal ? 'p.total' : 'COALESCE(SUM(a.valor_abono), 0)';
  const pagoClienteIdSelect = schema.pagosHasClienteId ? 'COALESCE(p.cliente_id, cl.id)' : 'cl.id';
  const clienteJoinKey = schema.pagosHasClienteId
    ? 'COALESCE(p.cliente_id, c.cliente_id)'
    : 'c.cliente_id';
  const canceladaSelect = schema.cuentasHasCancelada ? 'c.cancelada' : 'FALSE';
  const incluyeIvaSelect = schema.cuentasHasIncluyeIva ? 'COALESCE(c.incluye_iva, FALSE)' : 'FALSE';
  const incluyeRetFuenteSelect = schema.cuentasHasIncluyeRetencionFuente
    ? 'COALESCE(c.incluye_retencion_fuente, FALSE)'
    : 'FALSE';
  const incluyeRetIvaSelect = schema.cuentasHasIncluyeRetencionIva
    ? 'COALESCE(c.incluye_retencion_iva, FALSE)'
    : 'FALSE';

  return `WITH totales_abonos AS (
         SELECT num_factura, SUM(valor_abono) AS total_abonos
         FROM abonos
         GROUP BY num_factura
       )
       SELECT
         p.id,
         ${pagoFechaSelect} AS fecha,
         ${pagoMetodoSelect} AS metodo_pago,
         ${pagoReferenciaSelect} AS referencia,
         ${pagoNotasSelect} AS notas,
         ${pagoTotalSelect} AS total,
         ${pagoCreatedAtSelect} AS created_at,
         ${pagoClienteIdSelect} AS cliente_id,
         cl.nombre AS cliente,
         cl.identificacion,
         COUNT(a.id)::int AS facturas_count,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'abono_id', a.id,
               'num_factura', a.num_factura,
               'fecha_factura', c.fecha_factura,
               'valor_factura', c.valor_factura,
               'valor_abono', a.valor_abono,
               'cancelada', ${canceladaSelect},
               'saldo_pendiente',
                 CASE
                   WHEN c.num_factura IS NULL THEN NULL
                   WHEN ${canceladaSelect} THEN 0
                   ELSE (
                     c.valor_factura
                     + CASE WHEN ${incluyeIvaSelect} THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
                     - CASE WHEN ${incluyeRetFuenteSelect} THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
                     - CASE WHEN ${incluyeRetIvaSelect} AND ${incluyeIvaSelect} THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
                     - COALESCE(ta.total_abonos, 0)
                   )
                 END
             )
             ORDER BY a.num_factura
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) AS facturas
       FROM pagos p
       LEFT JOIN abonos a ON a.pago_id = p.id
       LEFT JOIN cuentas c ON c.num_factura = a.num_factura
       LEFT JOIN totales_abonos ta ON ta.num_factura = c.num_factura
       LEFT JOIN clientes cl ON cl.id = ${clienteJoinKey}
       GROUP BY p.id, cl.id, cl.nombre, cl.identificacion`;
};

const buildPagosListQuery = ({ filters, pagination, schema }) => {
  const baseQuery = buildPagosBaseQuery(schema);
  const { conditions, params } = buildPagosFilters(filters);

  return applyPaginationToQuery({
    baseQuery,
    conditions,
    params,
    pagination,
  });
};

const buildReporteCuentasSelect = (schema) => `SELECT
      v.num_factura,
      c.cliente_id,
      v.cliente,
      v.identificacion,
      v.fecha_factura,
      COALESCE(v.cancelada, FALSE) AS cancelada,
      ${schema.cuentasHasDetalleAnulacion ? 'c.detalle_anulacion' : 'NULL::text'} AS detalle_anulacion,
      ${schema.cuentasHasFechaAnulacion ? 'c.fecha_anulacion' : 'NULL::timestamp'} AS fecha_anulacion,
      v.incluye_iva,
      v.incluye_retencion_fuente,
      v.incluye_retencion_iva,
      v.subtotal,
      v.iva,
      v.retencion_fuente,
      v.retencion_iva,
      CASE WHEN COALESCE(v.cancelada, FALSE) THEN 0 ELSE v.por_cobrar END AS por_cobrar,
      v.total_abonos,
      CASE WHEN COALESCE(v.cancelada, FALSE) THEN 0 ELSE v.saldo_pendiente END AS saldo_pendiente
    FROM vista_reporte_cuentas v
    JOIN cuentas c ON c.num_factura = v.num_factura`;

const buildReporteFilters = ({ fecha_inicio, fecha_fin, solo_deudores, estado, search } = {}) => {
  const params = [];
  const conditions = [];

  if (fecha_inicio && fecha_fin) {
    conditions.push(`fecha_factura BETWEEN $${params.length + 1} AND $${params.length + 2}`);
    params.push(fecha_inicio, fecha_fin);
  }

  if (solo_deudores === 'true') {
    conditions.push('COALESCE(cancelada, FALSE) = FALSE');
    conditions.push('saldo_pendiente > 0');
  }

  if (estado === 'activa') {
    conditions.push('COALESCE(cancelada, FALSE) = FALSE');
  }
  if (estado === 'anulada') {
    conditions.push('COALESCE(cancelada, FALSE) = TRUE');
  }
  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(
      `(num_factura::text ILIKE $${params.length} OR cliente ILIKE $${params.length})`
    );
  }

  return { conditions, params };
};

const buildReporteListQuery = ({ filters, pagination, schema }) => {
  const baseQuery = buildReporteCuentasSelect(schema);
  const { conditions, params } = buildReporteFilters(filters);

  return applyPaginationToQuery({
    baseQuery,
    conditions,
    params,
    pagination,
    orderByClause:
      filters.agrupar_cliente === 'true' && !filters.sortBy
        ? `ORDER BY
        MIN(num_factura) OVER (PARTITION BY COALESCE(identificacion, cliente)) ASC,
        cliente ASC,
        num_factura ASC`
        : undefined,
  });
};

const buildReporteExportQuery = ({ filters, schema }) => {
  let query = buildReporteCuentasSelect(schema);
  const params = [];
  const conditions = [];

  if (filters.fecha_inicio && filters.fecha_fin) {
    conditions.push(`v.fecha_factura BETWEEN $${params.length + 1} AND $${params.length + 2}`);
    params.push(filters.fecha_inicio, filters.fecha_fin);
  }

  if (filters.solo_deudores === 'true') {
    conditions.push('COALESCE(v.cancelada, FALSE) = FALSE');
    conditions.push('v.saldo_pendiente > 0');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  if (filters.agrupar_cliente === 'true') {
    query += ` ORDER BY
        MIN(v.num_factura) OVER (PARTITION BY COALESCE(v.identificacion, v.cliente)),
        v.cliente ASC,
        v.num_factura ASC`;
  } else {
    query += ' ORDER BY v.num_factura ASC';
  }

  return { query, params };
};

const findPagos = async ({ filters, pagination }, executor = db) => {
  const schema = await getCuentasReadSchema(executor);
  const { countQuery, dataQuery, countParams, dataParams } = buildPagosListQuery({
    filters,
    pagination,
    schema,
  });
  const [countResult, result] = await Promise.all([
    executor.query(countQuery, countParams),
    executor.query(dataQuery, dataParams),
  ]);

  return { countResult, result };
};

const findReporte = async ({ filters, pagination }, executor = db) => {
  const schema = await getCuentasReadSchema(executor);
  const { countQuery, dataQuery, countParams, dataParams } = buildReporteListQuery({
    filters,
    pagination,
    schema,
  });
  const [countResult, result] = await Promise.all([
    executor.query(countQuery, countParams),
    executor.query(dataQuery, dataParams),
  ]);

  return { countResult, result };
};

const findFacturasCatalogo = async (executor = db) => {
  const schema = await getCuentasReadSchema(executor);
  const query = buildReporteCuentasSelect(schema) + ' ORDER BY v.num_factura ASC';

  return executor.query(query, []);
};

const findReporteForExport = async (filters, executor = db) => {
  const schema = await getCuentasReadSchema(executor);
  const { query, params } = buildReporteExportQuery({ filters, schema });

  return executor.query(query, params);
};

const __clearSchemaCacheForTests = () => {
  Object.keys(_schemaCache).forEach((key) => {
    delete _schemaCache[key];
  });
};

module.exports = {
  __clearSchemaCacheForTests,
  applyPaginationToQuery,
  buildPagosListQuery,
  buildReporteCuentasSelect,
  buildReporteExportQuery,
  buildReporteListQuery,
  findFacturasCatalogo,
  findPagos,
  findReporte,
  findReporteForExport,
  getCuentasReadSchema,
  tableColumnExists,
  tableExists,
};
