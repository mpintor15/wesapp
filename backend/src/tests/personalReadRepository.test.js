jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const personalReadRepository = require('../repositories/personal/personalReadRepository');

const normalizeSql = (sql) => String(sql).replace(/\s+/g, ' ').trim();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('personalReadRepository.buildColaboradoresQuery', () => {
  test('genera consulta base con LEFT JOIN a usuarios y orden estable', () => {
    const { query, params } = personalReadRepository.buildColaboradoresQuery();
    const sql = normalizeSql(query);

    expect(sql).toBe(
      'SELECT c.*, u.id AS usuario_id, u.usuario AS usuario_usuario, ' +
        'u.tipo_usuario AS usuario_tipo_usuario, u.activo AS usuario_activo, ' +
        'u.primer_login AS usuario_primer_login FROM colaboradores c ' +
        'LEFT JOIN usuarios u ON u.colaborador_id = c.id ' +
        'ORDER BY c.nombres_completos ASC, c.id ASC'
    );
    expect(params).toEqual([]);
  });

  test('preserva búsqueda, filtros y orden de parámetros, calificados con el alias c.', () => {
    const { query, params } = personalReadRepository.buildColaboradoresQuery({
      search: 'ana',
      estado: 'activo',
      cargo: 'supervisora',
    });
    const sql = normalizeSql(query);

    expect(sql).toContain(
      'FROM colaboradores c LEFT JOIN usuarios u ON u.colaborador_id = c.id WHERE'
    );
    expect(sql).toContain('c.nombres_completos ILIKE $1');
    expect(sql).toContain('c.cedula ILIKE $1');
    expect(sql).toContain('c.celular ILIKE $1');
    expect(sql).toContain('c.numero_cuenta ILIKE $1');
    expect(sql).toContain('c.estado = $2');
    expect(sql).toContain('c.cargo ILIKE $3');
    expect(sql).toContain('ORDER BY c.nombres_completos ASC, c.id ASC');
    expect(params).toEqual(['%ana%', 'activo', 'supervisora']);
  });

  test('no agrega filtros vacíos a exportaciones', () => {
    const { query, params } = personalReadRepository.buildColaboradoresQuery({
      search: '',
      estado: undefined,
      cargo: '',
    });
    const sql = normalizeSql(query);

    expect(sql).not.toMatch(/WHERE/i);
    expect(params).toEqual([]);
  });
});

describe('personalReadRepository.findColaboradores', () => {
  test('usa executor inyectado, agrega COUNT(*) OVER(), el join a usuarios y pagina con LIMIT/OFFSET', async () => {
    const executor = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1, total_count: 1 }], rowCount: 1 }),
    };

    await expect(
      personalReadRepository.findColaboradores(
        { estado: 'activo' },
        { pageSize: 25, offset: 0 },
        executor
      )
    ).resolves.toEqual({ rows: [{ id: 1, total_count: 1 }], rowCount: 1 });

    const [sql, params] = executor.query.mock.calls[0];
    const normalized = normalizeSql(sql);
    expect(normalized).toContain('COUNT(*) OVER()::int AS total_count');
    expect(normalized).toContain('c.*,');
    expect(normalized).toContain('usuario_id');
    expect(normalized).toContain(
      'FROM colaboradores c LEFT JOIN usuarios u ON u.colaborador_id = c.id'
    );
    expect(normalized).toContain('LIMIT $2 OFFSET $3');
    expect(params).toEqual(['activo', 25, 0]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('findColaboradoresForExport no pagina y propaga errores del executor', async () => {
    const error = new Error('db down');
    const executor = {
      query: jest.fn().mockRejectedValue(error),
    };

    await expect(
      personalReadRepository.findColaboradoresForExport({ search: 'ana' }, executor)
    ).rejects.toThrow('db down');
    expect(executor.query.mock.calls[0][0]).not.toMatch(/LIMIT|OFFSET/i);
  });
});
