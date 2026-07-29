jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const {
  FACTURAS_SORT_COLUMNS,
  PAGOS_SORT_COLUMNS,
} = require('../modules/cuentas/cuentas.constants');
const cuentasReadRepository = require('../repositories/cuentasReadRepository');

const normalizeSql = (sql) => String(sql).replace(/\s+/g, ' ').trim();
const sqlQuote = String.fromCharCode(39);
const emptySqlString = `${sqlQuote}${sqlQuote}`;

const fullSchema = Object.freeze({
  pagosTableExists: true,
  abonosHasPagoId: true,
  pagosHasClienteId: true,
  pagosHasFecha: true,
  pagosHasMetodoPago: true,
  pagosHasReferencia: true,
  pagosHasNotas: true,
  pagosHasTotal: true,
  pagosHasCreatedAt: true,
  cuentasHasCancelada: true,
  cuentasHasIncluyeIva: true,
  cuentasHasIncluyeRetencionFuente: true,
  cuentasHasIncluyeRetencionIva: true,
  cuentasHasDetalleAnulacion: true,
  cuentasHasFechaAnulacion: true,
});

const pagination = Object.freeze({
  page: 2,
  pageSize: 25,
  offset: 25,
  sortExpression: 'created_at',
  sortOrder: 'desc',
});

describe('cuentasReadRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasReadRepository.__clearSchemaCacheForTests();
  });

  test('expone allowlists de ordenamiento congeladas para Cuentas', () => {
    expect(Object.isFrozen(FACTURAS_SORT_COLUMNS)).toBe(true);
    expect(Object.isFrozen(PAGOS_SORT_COLUMNS)).toBe(true);
    expect(FACTURAS_SORT_COLUMNS).toEqual(
      expect.objectContaining({
        num_factura: 'num_factura',
        fecha_factura: 'fecha_factura',
        cliente: 'cliente',
        identificacion: 'identificacion',
      })
    );
    expect(PAGOS_SORT_COLUMNS).toEqual(
      expect.objectContaining({
        fecha: 'fecha',
        total: 'total',
        cliente: 'cliente',
        metodo_pago: 'metodo_pago',
        created_at: 'created_at',
      })
    );
  });

  test('buildPagosListQuery conserva filtros, count, data y paginación', () => {
    const query = cuentasReadRepository.buildPagosListQuery({
      filters: {
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-01-31',
        metodo_pago: 'transferencia',
        search: 'Cliente',
      },
      pagination,
      schema: fullSchema,
    });

    expect(normalizeSql(query.countQuery)).toContain(
      'SELECT COUNT(*)::int AS total FROM (WITH totales_abonos AS'
    );
    expect(normalizeSql(query.dataQuery)).toContain(
      'WHERE fecha BETWEEN $1 AND $2 AND LOWER(COALESCE(metodo_pago, ' +
        emptySqlString +
        ')) = $3 AND (cliente ILIKE $4 OR total::text ILIKE $4)'
    );
    expect(normalizeSql(query.dataQuery)).toContain('ORDER BY created_at DESC LIMIT $5 OFFSET $6');
    expect(query.countParams).toEqual(['2024-01-01', '2024-01-31', 'transferencia', '%Cliente%']);
    expect(query.dataParams).toEqual([
      '2024-01-01',
      '2024-01-31',
      'transferencia',
      '%Cliente%',
      25,
      25,
    ]);
  });

  test('buildPagosListQuery conserva camino legacy cuando no existe tabla pagos', () => {
    const query = cuentasReadRepository.buildPagosListQuery({
      filters: {},
      pagination,
      schema: { ...fullSchema, pagosTableExists: false },
    });

    expect(normalizeSql(query.dataQuery)).toContain('FROM abonos a JOIN cuentas c');
    expect(normalizeSql(query.dataQuery)).toContain('JSON_BUILD_ARRAY');
    expect(normalizeSql(query.dataQuery)).toContain('LIMIT $1 OFFSET $2');
    expect(query.countParams).toEqual([]);
    expect(query.dataParams).toEqual([25, 25]);
  });

  test('buildReporteListQuery conserva filtros de reporte y orden agrupado por cliente', () => {
    const query = cuentasReadRepository.buildReporteListQuery({
      filters: {
        fecha_inicio: '2024-02-01',
        fecha_fin: '2024-02-29',
        solo_deudores: 'true',
        agrupar_cliente: 'true',
        search: '1001',
      },
      pagination: {
        ...pagination,
        sortExpression: 'cliente',
        sortOrder: 'asc',
      },
      schema: fullSchema,
    });

    const dataSql = normalizeSql(query.dataQuery);
    expect(dataSql).toContain('fecha_factura BETWEEN $1 AND $2');
    expect(dataSql).toContain('COALESCE(cancelada, FALSE) = FALSE');
    expect(dataSql).toContain('saldo_pendiente > 0');
    expect(dataSql).toContain('(num_factura::text ILIKE $3 OR cliente ILIKE $3)');
    expect(dataSql).toContain(
      'ORDER BY MIN(num_factura) OVER (PARTITION BY COALESCE(identificacion, cliente)) ASC, cliente ASC, num_factura ASC'
    );
    expect(query.countParams).toEqual(['2024-02-01', '2024-02-29', '%1001%']);
    expect(query.dataParams).toEqual(['2024-02-01', '2024-02-29', '%1001%', 25, 25]);
  });

  test('buildReporteListQuery usa el orden paginado cuando sortBy fue explícito', () => {
    const query = cuentasReadRepository.buildReporteListQuery({
      filters: {
        agrupar_cliente: 'true',
        sortBy: 'cliente',
      },
      pagination: {
        ...pagination,
        sortExpression: 'cliente',
        sortOrder: 'asc',
      },
      schema: fullSchema,
    });

    expect(normalizeSql(query.dataQuery)).toContain('ORDER BY cliente ASC LIMIT $1 OFFSET $2');
  });

  test('buildReporteExportQuery conserva exportación completa sin LIMIT ni OFFSET', () => {
    const { query, params } = cuentasReadRepository.buildReporteExportQuery({
      filters: {
        fecha_inicio: '2024-03-01',
        fecha_fin: '2024-03-31',
        solo_deudores: 'true',
        agrupar_cliente: 'true',
      },
      schema: fullSchema,
    });

    const sql = normalizeSql(query);
    expect(sql).toContain('v.fecha_factura BETWEEN $1 AND $2');
    expect(sql).toContain('COALESCE(v.cancelada, FALSE) = FALSE');
    expect(sql).toContain('v.saldo_pendiente > 0');
    expect(sql).toContain(
      'ORDER BY MIN(v.num_factura) OVER (PARTITION BY COALESCE(v.identificacion, v.cliente)), v.cliente ASC, v.num_factura ASC'
    );
    expect(sql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/i);
    expect(params).toEqual(['2024-03-01', '2024-03-31']);
  });

  test('findPagos usa executor inyectado para introspección, count y data', async () => {
    const executor = {
      query: jest.fn(async (sql) => {
        const normalized = normalizeSql(sql);
        if (normalized.includes('to_regclass')) {
          return { rows: [{ table_name: 'pagos' }] };
        }
        if (normalized.includes('information_schema.columns')) {
          return { rowCount: 1, rows: [{ '?column?': 1 }] };
        }
        if (normalized.startsWith('SELECT COUNT(*)::int AS total')) {
          return { rows: [{ total: 1 }] };
        }
        if (normalized.startsWith('SELECT * FROM')) {
          return { rows: [{ id: 9, cliente: 'Cliente' }] };
        }
        throw new Error(`Unexpected SQL: ${normalized}`);
      }),
    };

    const result = await cuentasReadRepository.findPagos(
      {
        filters: { metodo_pago: 'efectivo' },
        pagination,
      },
      executor
    );

    expect(result.countResult.rows[0].total).toBe(1);
    expect(result.result.rows[0].id).toBe(9);
    expect(executor.query).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
    const queries = executor.query.mock.calls.map(([sql]) => normalizeSql(sql));
    expect(queries.some((sql) => sql.startsWith('SELECT COUNT(*)::int AS total'))).toBe(true);
    expect(queries.some((sql) => sql.includes('LOWER(COALESCE(metodo_pago'))).toBe(true);
  });

  test('findFacturasCatalogo conserva catálogo completo sin paginación', async () => {
    const executor = {
      query: jest.fn(async (sql) => {
        const normalized = normalizeSql(sql);
        if (normalized.includes('to_regclass')) {
          return { rows: [{ table_name: 'pagos' }] };
        }
        if (normalized.includes('information_schema.columns')) {
          return { rowCount: 1, rows: [] };
        }
        return { rows: [{ num_factura: 1001 }] };
      }),
    };

    const result = await cuentasReadRepository.findFacturasCatalogo(executor);

    expect(result.rows).toEqual([{ num_factura: 1001 }]);
    const finalSql = normalizeSql(executor.query.mock.calls.at(-1)[0]);
    expect(finalSql).toContain('FROM vista_reporte_cuentas v JOIN cuentas c');
    expect(finalSql).toContain('ORDER BY v.num_factura ASC');
    expect(finalSql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/i);
    expect(executor.query.mock.calls.at(-1)[1]).toEqual([]);
  });

  test('propaga errores de base de datos sin transformarlos', async () => {
    const error = new Error('db down');
    db.query.mockRejectedValueOnce(error);

    await expect(cuentasReadRepository.tableExists('pagos')).rejects.toBe(error);
  });
});
