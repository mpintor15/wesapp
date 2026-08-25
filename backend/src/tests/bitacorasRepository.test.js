jest.mock('../config/database', () => ({ query: jest.fn() }));

const db = require('../config/database');
const repository = require('../repositories/bitacorasRepository');

beforeEach(() => jest.clearAllMocks());

describe('bitacorasRepository', () => {
  test('historial asignado usa EXISTS, filtros, orden estable y paginación', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 12 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 1 }] });

    const result = await repository.findHistory({
      filters: {
        ubicacionId: 4,
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-20',
        estado: 'REGISTRADA',
        autor: 'ana',
      },
      hasGlobalScope: false,
      userId: 7,
      pagination: { pageSize: 10, offset: 10 },
    });

    const [countSql, countParams] = db.query.mock.calls[0];
    const [dataSql, dataParams] = db.query.mock.calls[1];
    expect(countSql).toContain('FROM usuario_ubicaciones uu');
    expect(countSql).toContain('uu.usuario_id = $1');
    expect(dataSql).toContain('FROM usuario_ubicaciones uu');
    expect(dataSql).toContain('uu.usuario_id = $1');
    expect(dataSql).toContain('uu.ubicacion_id = br.ubicacion_id');
    expect(countSql).toContain('br.ubicacion_id = $2');
    expect(countSql).toContain(String.raw`br.ocurrido_at < ($4::date + INTERVAL '1 day')`);
    expect(countSql).toContain('br.estado = $5');
    expect(countSql).toContain('autor_c.nombres_completos ILIKE $6');
    expect(countSql).toContain('autor_u.usuario ILIKE $6');
    expect(dataSql).toContain('autor_c.nombres_completos ILIKE $6');
    expect(dataSql).toContain('autor_u.usuario ILIKE $6');
    expect(countParams).toEqual([7, 4, '2026-08-01', '2026-08-20', 'REGISTRADA', '%ana%']);
    expect(dataSql).toContain('ORDER BY br.ocurrido_at DESC, br.id DESC');
    expect(dataSql).toContain('LIMIT $7 OFFSET $8');
    expect(dataParams).toEqual([7, 4, '2026-08-01', '2026-08-20', 'REGISTRADA', '%ana%', 10, 10]);
    expect(result).toEqual({ items: [{ id: 2 }, { id: 1 }], total: 12 });
  });

  test('bloquea la asignación concreta con el helper productivo', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ usuario_id: 7, ubicacion_id: 4 }],
      }),
    };

    const result = await repository.findLockedUserLocationAssignment({
      client,
      userId: 7,
      locationId: 4,
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('WHERE usuario_id = $1 AND ubicacion_id = $2');
    expect(sql).toContain('FOR KEY SHARE');
    expect(params).toEqual([7, 4]);
    expect(result).toEqual({ usuario_id: 7, ubicacion_id: 4 });
  });

  test('historial global no consulta asignaciones', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await repository.findHistory({
      filters: {},
      hasGlobalScope: true,
      userId: 7,
      pagination: { pageSize: 25, offset: 0 },
    });
    expect(db.query.mock.calls[0][0]).not.toContain('usuario_ubicaciones');
    expect(db.query.mock.calls[1][0]).toContain('LIMIT $1 OFFSET $2');
  });

  test('ubicaciones visibles limitadas usa la asignación y devuelve campos mínimos', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1, nombre: 'Punto' }] });
    await repository.findVisibleLocations({ hasGlobalScope: false, userId: 7 });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('uu.ubicacion_id = u.id');
    expect(sql).toContain('u.cliente_id');
    expect(sql).toContain('u.tipo_punto');
    expect(params).toEqual([7]);
  });
});
