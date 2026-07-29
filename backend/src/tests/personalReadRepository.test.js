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
  test('genera consulta base con orden estable', () => {
    const { query, params } = personalReadRepository.buildColaboradoresQuery();
    const sql = normalizeSql(query);

    expect(sql).toBe('SELECT * FROM colaboradores ORDER BY nombres_completos ASC');
    expect(params).toEqual([]);
  });

  test('preserva búsqueda, filtros y orden de parámetros', () => {
    const { query, params } = personalReadRepository.buildColaboradoresQuery({
      search: 'ana',
      estado: 'activo',
      cargo: 'supervisora',
    });
    const sql = normalizeSql(query);

    expect(sql).toContain('FROM colaboradores WHERE');
    expect(sql).toContain('nombres_completos ILIKE $1');
    expect(sql).toContain('cedula ILIKE $1');
    expect(sql).toContain('celular ILIKE $1');
    expect(sql).toContain('numero_cuenta ILIKE $1');
    expect(sql).toContain('estado = $2');
    expect(sql).toContain('cargo ILIKE $3');
    expect(sql).toContain('ORDER BY nombres_completos ASC');
    expect(params).toEqual(['%ana%', 'activo', 'supervisora']);
  });

  test('no agrega filtros vacíos ni paginación a exportaciones', () => {
    const { query, params } = personalReadRepository.buildColaboradoresQuery({
      search: '',
      estado: undefined,
      cargo: '',
    });
    const sql = normalizeSql(query);

    expect(sql).not.toMatch(/WHERE/i);
    expect(sql).not.toMatch(/LIMIT|OFFSET/i);
    expect(params).toEqual([]);
  });
});

describe('personalReadRepository.findColaboradores', () => {
  test('usa executor inyectado', async () => {
    const executor = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
    };

    await expect(
      personalReadRepository.findColaboradores({ estado: 'activo' }, executor)
    ).resolves.toEqual({ rows: [{ id: 1 }], rowCount: 1 });

    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('FROM colaboradores'), [
      'activo',
    ]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('findColaboradoresForExport propaga errores del executor', async () => {
    const error = new Error('db down');
    const executor = {
      query: jest.fn().mockRejectedValue(error),
    };

    await expect(
      personalReadRepository.findColaboradoresForExport({ search: 'ana' }, executor)
    ).rejects.toThrow('db down');
  });
});
