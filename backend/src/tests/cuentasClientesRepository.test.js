jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const cuentasClientesRepository = require('../repositories/cuentasClientesRepository');

const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();

describe('cuentasClientesRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findAllClientes usa consulta de clientes activos y ordenamiento esperado', async () => {
    const expected = { rows: [{ id: 1, nombre: 'Ana', identificacion: '0101', estado: 'activo' }] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasClientesRepository.findAllClientes();

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT id, nombre, identificacion, estado FROM clientes WHERE estado = $1 ORDER BY nombre ASC'
    );
    expect(db.query.mock.calls[0][1]).toEqual(['activo']);
  });

  test('findClientesForExport conserva columnas y orden para Excel', async () => {
    const expected = { rows: [{ nombre: 'Ana', identificacion: '0101' }] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasClientesRepository.findClientesForExport();

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT nombre, identificacion FROM clientes ORDER BY nombre ASC'
    );
    expect(db.query.mock.calls[0][1]).toBeUndefined();
  });

  test('createCliente conserva columnas, placeholders, parámetros y RETURNING', async () => {
    const expected = { rowCount: 1, rows: [{ id: 2, nombre: 'Luis', identificacion: '0202' }] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasClientesRepository.createCliente({
      nombre: 'Luis',
      identificacion: '0202',
    });

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'INSERT INTO clientes (nombre, identificacion) VALUES ($1, $2) RETURNING id, nombre, identificacion'
    );
    expect(db.query.mock.calls[0][1]).toEqual(['Luis', '0202']);
  });

  test('findClienteFacturasDependency conserva consulta de dependencia', async () => {
    const expected = { rowCount: 1, rows: [{ '?column?': 1 }] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasClientesRepository.findClienteFacturasDependency(7);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT 1 FROM cuentas WHERE cliente_id = $1 LIMIT 1'
    );
    expect(db.query.mock.calls[0][1]).toEqual([7]);
  });

  test('findClienteIdById conserva lectura de cliente y estado por id', async () => {
    const expected = { rowCount: 1, rows: [{ id: 7, estado: 'activo' }] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasClientesRepository.findClienteIdById(7);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT id, estado FROM clientes WHERE id = $1 LIMIT 1'
    );
    expect(db.query.mock.calls[0][1]).toEqual([7]);
  });

  test('deleteClienteById conserva RETURNING y no transforma cero filas', async () => {
    const expected = { rowCount: 0, rows: [] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasClientesRepository.deleteClienteById(9);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'DELETE FROM clientes WHERE id = $1 RETURNING id, nombre, identificacion'
    );
    expect(db.query.mock.calls[0][1]).toEqual([9]);
  });

  test('permite usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await cuentasClientesRepository.findAllClientes(executor);

    expect(executor.query).toHaveBeenCalledWith(
      'SELECT id, nombre, identificacion, estado FROM clientes WHERE estado = $1 ORDER BY nombre ASC',
      ['activo']
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  test('findClienteIdById permite executor explícito y propaga errores', async () => {
    const executor = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 7, estado: 'activo' }] }),
    };

    await cuentasClientesRepository.findClienteIdById(7, executor);

    expect(executor.query).toHaveBeenCalledWith(
      'SELECT id, estado FROM clientes WHERE id = $1 LIMIT 1',
      [7]
    );
    expect(db.query).not.toHaveBeenCalled();

    const error = new Error('db down');
    db.query.mockRejectedValueOnce(error);
    await expect(cuentasClientesRepository.findClienteIdById(7)).rejects.toBe(error);
  });
});
