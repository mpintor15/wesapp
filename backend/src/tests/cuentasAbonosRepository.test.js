jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const cuentasAbonosRepository = require('../repositories/cuentasAbonosRepository');

const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();

describe('cuentasAbonosRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findAbonosByFactura conserva SQL, joins, subquery, orden y parámetros', async () => {
    const expected = {
      rows: [
        {
          id: 1,
          pago_id: 10,
          fecha_abono: '2024-01-02',
          valor_abono: '75.00',
          fecha_pago: '2024-01-02',
          metodo_pago: 'efectivo',
          referencia: null,
          notas: '',
          pago_total: '75.00',
          pago_facturas_count: '1',
        },
      ],
      rowCount: 1,
    };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasAbonosRepository.findAbonosByFactura(1001);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      [
        'SELECT a.id, a.pago_id, a.fecha_abono, a.valor_abono, p.fecha AS fecha_pago,',
        'p.metodo_pago, p.referencia, p.notas, p.total AS pago_total, CASE WHEN',
        'a.pago_id IS NULL THEN 1 ELSE ( SELECT COUNT(*) FROM abonos a2 WHERE',
        'a2.pago_id = a.pago_id ) END AS pago_facturas_count FROM abonos a',
        'LEFT JOIN pagos p ON p.id = a.pago_id WHERE a.num_factura = $1',
        'ORDER BY a.fecha_abono DESC, a.id DESC',
      ].join(' ')
    );
    expect(db.query.mock.calls[0][1]).toEqual([1001]);
  });

  test('permite usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await cuentasAbonosRepository.findAbonosByFactura(2002, executor);

    expect(executor.query).toHaveBeenCalledTimes(1);
    expect(executor.query.mock.calls[0][1]).toEqual([2002]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('propaga errores de base de datos sin transformarlos', async () => {
    const error = new Error('db down');
    db.query.mockRejectedValueOnce(error);

    await expect(cuentasAbonosRepository.findAbonosByFactura(1001)).rejects.toBe(error);
  });

  test('findAbonoForDeletion conserva SELECT, filtro y parámetros', async () => {
    const expected = {
      rows: [{ id: 5, pago_id: 10, num_factura: 1001, valor_abono: 200 }],
      rowCount: 1,
    };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasAbonosRepository.findAbonoForDeletion(5);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT id, pago_id, num_factura, valor_abono FROM abonos WHERE id = $1'
    );
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  test('createAbono conserva INSERT, columnas, placeholders, parámetros y ausencia de RETURNING', async () => {
    const expected = { rows: [], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasAbonosRepository.createAbono({
      pagoId: 10,
      numFactura: 1001,
      fechaAbono: '2024-01-01',
      valorAbono: 250,
    });

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3, $4)'
    );
    expect(normalizeSql(db.query.mock.calls[0][0])).not.toContain('RETURNING');
    expect(db.query.mock.calls[0][1]).toEqual([10, 1001, '2024-01-01', 250]);
  });

  test('deleteAbonoById conserva DELETE y parámetros', async () => {
    const expected = { rows: [], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasAbonosRepository.deleteAbonoById(5);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe('DELETE FROM abonos WHERE id = $1');
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  test('countAbonosByPagoId conserva COUNT, alias y parámetros', async () => {
    const expected = { rows: [{ cnt: '0' }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasAbonosRepository.countAbonosByPagoId(10);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT COUNT(*) AS cnt FROM abonos WHERE pago_id = $1'
    );
    expect(db.query.mock.calls[0][1]).toEqual([10]);
  });

  test('las consultas de eliminación permiten usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await cuentasAbonosRepository.createAbono(
      {
        pagoId: 10,
        numFactura: 1001,
        fechaAbono: '2024-01-01',
        valorAbono: 250,
      },
      executor
    );
    await cuentasAbonosRepository.deleteAbonoById(5, executor);

    expect(executor.query).toHaveBeenCalledTimes(2);
    expect(executor.query.mock.calls[0][1]).toEqual([10, 1001, '2024-01-01', 250]);
    expect(executor.query.mock.calls[1][1]).toEqual([5]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('las consultas de eliminación propagan errores sin transformarlos', async () => {
    const error = new Error('delete failed');
    db.query.mockRejectedValueOnce(error);

    await expect(cuentasAbonosRepository.deleteAbonoById(5)).rejects.toBe(error);
  });
});
