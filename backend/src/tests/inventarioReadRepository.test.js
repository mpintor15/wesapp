jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const {
  ALERTA_ESTADOS,
  ARTICULOS_SORT_COLUMNS,
  MOVIMIENTOS_SORT_COLUMNS,
} = require('../services/inventario/inventarioDomain');
const inventarioReadRepository = require('../repositories/inventario/inventarioReadRepository');

const normalizeSql = (sql) => String(sql).replace(/\s+/g, ' ').trim();

describe('inventarioReadRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('expone constantes de dominio sin mutar allowlists', () => {
    const articulosKeys = Object.keys(ARTICULOS_SORT_COLUMNS);
    const movimientosKeys = Object.keys(MOVIMIENTOS_SORT_COLUMNS);

    expect(ALERTA_ESTADOS.has('vencida')).toBe(true);
    expect(ARTICULOS_SORT_COLUMNS.created_at).toBe('created_at');
    expect(MOVIMIENTOS_SORT_COLUMNS.fecha_movimiento).toBe('fecha_movimiento');
    expect(Object.isFrozen(ARTICULOS_SORT_COLUMNS)).toBe(true);
    expect(Object.isFrozen(MOVIMIENTOS_SORT_COLUMNS)).toBe(true);
    expect(Object.keys(ARTICULOS_SORT_COLUMNS)).toEqual(articulosKeys);
    expect(Object.keys(MOVIMIENTOS_SORT_COLUMNS)).toEqual(movimientosKeys);
  });

  test('buildInventarioAlertasQuery conserva filtros y orden de parámetros', () => {
    const filters = {
      tipo: 'radio',
      ubicacion_id: '3',
      estado: 'vigente',
      search: 'Motorola',
    };

    const result = inventarioReadRepository.buildInventarioAlertasQuery(filters);

    expect(normalizeSql(result.where)).toContain('tipo_articulo = $1');
    expect(normalizeSql(result.where)).toContain('ubicacion_id = $2');
    expect(normalizeSql(result.where)).toContain('estado_caducidad = $3');
    expect(normalizeSql(result.where)).toContain('nombre_articulo ILIKE $4');
    expect(result.params).toEqual(['radio', 3, 'vigente', '%Motorola%']);
    expect(filters).toEqual({
      tipo: 'radio',
      ubicacion_id: '3',
      estado: 'vigente',
      search: 'Motorola',
    });
  });

  test('buildInventarioAlertasQuery omite filtros vacíos sin mutar entrada', () => {
    const filters = {
      tipo: '',
      ubicacion_id: undefined,
      estado: null,
      search: '',
    };

    const result = inventarioReadRepository.buildInventarioAlertasQuery(filters);

    expect(result.where).toBe('');
    expect(result.params).toEqual([]);
    expect(filters).toEqual({
      tipo: '',
      ubicacion_id: undefined,
      estado: null,
      search: '',
    });
  });

  test('buildInventarioAlertasQuery conserva string válido en búsqueda', () => {
    const result = inventarioReadRepository.buildInventarioAlertasQuery({
      search: '0',
    });

    expect(normalizeSql(result.where)).toContain('nombre_articulo ILIKE $1');
    expect(result.params).toEqual(['%0%']);
  });

  test('findArticulos ejecuta COUNT y datos paginados con executor explícito', async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: 40 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }),
    };
    const pagination = {
      pageSize: 25,
      offset: 25,
      sortExpression: 'created_at',
      sortOrder: 'desc',
    };

    const result = await inventarioReadRepository.findArticulos(
      {
        filters: { tipo: 'equipo', search: 'Casco' },
        pagination,
      },
      executor
    );

    expect(result.countResult.rows[0].total).toBe(40);
    expect(result.result.rows).toEqual([{ id: 1 }]);
    expect(executor.query).toHaveBeenCalledTimes(2);
    expect(normalizeSql(executor.query.mock.calls[0][0])).toContain(
      'SELECT COUNT(*)::int AS total FROM vista_inventario_alertas WHERE tipo_articulo = $1'
    );
    expect(normalizeSql(executor.query.mock.calls[1][0])).toContain(
      'ORDER BY created_at DESC LIMIT $3 OFFSET $4'
    );
    expect(executor.query.mock.calls[1][1]).toEqual(['equipo', '%Casco%', 25, 25]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('findArticulos mantiene filtros idénticos entre COUNT y datos', async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await inventarioReadRepository.findArticulos(
      {
        filters: {
          tipo: 'arma',
          ubicacion_id: '8',
          estado: 'por_vencer',
          search: 'serie-123',
        },
        pagination: {
          pageSize: 10,
          offset: 20,
          sortExpression: 'nombre_articulo',
          sortOrder: 'asc',
        },
      },
      executor
    );

    const [countSql, dataSql] = executor.query.mock.calls.map(([sql]) => normalizeSql(sql));
    expect(countSql).toContain('tipo_articulo = $1');
    expect(countSql).toContain('ubicacion_id = $2');
    expect(countSql).toContain('estado_caducidad = $3');
    expect(countSql).toContain('nombre_articulo ILIKE $4');
    expect(countSql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/i);
    expect(dataSql).toContain('tipo_articulo = $1');
    expect(dataSql).toContain('ubicacion_id = $2');
    expect(dataSql).toContain('estado_caducidad = $3');
    expect(dataSql).toContain('nombre_articulo ILIKE $4');
    expect(dataSql).toContain('ORDER BY nombre_articulo ASC LIMIT $5 OFFSET $6');
    expect(executor.query.mock.calls[0][1]).toEqual(['arma', 8, 'por_vencer', '%serie-123%']);
    expect(executor.query.mock.calls[1][1]).toEqual([
      'arma',
      8,
      'por_vencer',
      '%serie-123%',
      10,
      20,
    ]);
  });

  test('findArticulosCatalogo conserva consulta sin paginación', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await inventarioReadRepository.findArticulosCatalogo();

    expect(result.rows).toEqual([{ id: 1 }]);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT * FROM vista_inventario_alertas ORDER BY nombre_articulo ASC, id ASC'
    );
    expect(db.query.mock.calls[0][1]).toEqual([]);
  });

  test('findArticulosForExport conserva filtros y no agrega LIMIT', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await inventarioReadRepository.findArticulosForExport({
      ubicacion_id: '4',
      estado: 'vencida',
    });

    const sql = normalizeSql(db.query.mock.calls[0][0]);
    expect(sql).toContain('FROM vista_inventario_alertas WHERE ubicacion_id = $1');
    expect(sql).toContain('estado_caducidad = $2');
    expect(sql).toContain('ORDER BY created_at DESC');
    expect(sql).not.toMatch(/\bLIMIT\b/i);
    expect(db.query.mock.calls[0][1]).toEqual([4, 'vencida']);
  });

  test('buildMovimientosListQuery conserva filtros, búsqueda, paginación y aliases', () => {
    const query = inventarioReadRepository.buildMovimientosListQuery({
      search: 'Casco',
      destino_id: '7',
      from: '2026-01-01',
      to: '2026-01-31',
      pagination: {
        pageSize: 50,
        offset: 100,
        sortExpression: 'fecha_movimiento',
        sortOrder: 'asc',
      },
    });
    const dataSql = normalizeSql(query.dataQuery);

    expect(dataSql).toContain('AS reversible');
    expect(dataSql).toContain('AS reversal_status');
    expect(dataSql).toContain('articulos_movidos ILIKE $1');
    expect(dataSql).toContain('ubicacion_destino_id = $2');
    expect(dataSql).toContain('fecha_movimiento::date >= $3::date');
    expect(dataSql).toContain('fecha_movimiento::date <= $4::date');
    expect(dataSql).toContain('ORDER BY fecha_movimiento ASC LIMIT $5 OFFSET $6');
    expect(query.countParams).toEqual(['%Casco%', 7, '2026-01-01', '2026-01-31']);
    expect(query.dataParams).toEqual(['%Casco%', 7, '2026-01-01', '2026-01-31', 50, 100]);
  });

  test('findMovimientos ejecuta COUNT y datos con el mismo executor', async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, reversal_status: 'COMPLETE' }] }),
    };

    const result = await inventarioReadRepository.findMovimientos(
      {
        search: '',
        destino_id: undefined,
        from: undefined,
        to: undefined,
        pagination: {
          pageSize: 10,
          offset: 0,
          sortExpression: 'fecha_movimiento',
          sortOrder: 'desc',
        },
      },
      executor
    );

    expect(result.countResult.rows[0].total).toBe(2);
    expect(result.result.rows[0].reversal_status).toBe('COMPLETE');
    expect(executor.query).toHaveBeenCalledTimes(2);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('buildMovimientosListQuery aplica filtros iguales en COUNT y datos sin paginar COUNT', () => {
    const query = inventarioReadRepository.buildMovimientosListQuery({
      search: 'Patio',
      destino_id: '4',
      from: '2026-04-01',
      to: '2026-04-30',
      pagination: {
        pageSize: 100,
        offset: 100,
        sortExpression: 'id',
        sortOrder: 'desc',
      },
    });
    const countSql = normalizeSql(query.countQuery);
    const dataSql = normalizeSql(query.dataQuery);

    expect(countSql).toContain('articulos_movidos ILIKE $1');
    expect(countSql).toContain('ubicacion_destino_id = $2');
    expect(countSql).toContain('fecha_movimiento::date >= $3::date');
    expect(countSql).toContain('fecha_movimiento::date <= $4::date');
    expect(countSql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/i);
    expect(dataSql).toContain('articulos_movidos ILIKE $1');
    expect(dataSql).toContain('ubicacion_destino_id = $2');
    expect(dataSql).toContain('fecha_movimiento::date >= $3::date');
    expect(dataSql).toContain('fecha_movimiento::date <= $4::date');
    expect(dataSql).toContain('ORDER BY id DESC LIMIT $5 OFFSET $6');
    expect(query.countParams).toEqual(['%Patio%', 4, '2026-04-01', '2026-04-30']);
    expect(query.dataParams).toEqual(['%Patio%', 4, '2026-04-01', '2026-04-30', 100, 100]);
  });

  test('propaga errores de base de datos sin transformarlos', async () => {
    const error = new Error('db down');
    db.query.mockRejectedValueOnce(error);

    await expect(
      inventarioReadRepository.findArticulos({
        filters: {},
        pagination: {
          pageSize: 25,
          offset: 0,
          sortExpression: 'created_at',
          sortOrder: 'desc',
        },
      })
    ).rejects.toBe(error);
  });
});
