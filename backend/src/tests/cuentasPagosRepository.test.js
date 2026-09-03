jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const cuentasPagosRepository = require('../repositories/cuentasPagosRepository');

const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();
const sqlQuote = String.fromCharCode(39);

describe('cuentasPagosRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findPagosForExport conserva consulta base sin filtros', async () => {
    const expected = { rows: [{ id: 1, cliente: 'Cliente A' }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasPagosRepository.findPagosForExport();

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      [
        `SELECT p.id, p.fecha, COALESCE(cl.nombre, ${sqlQuote}-${sqlQuote}) AS cliente,`,
        `COALESCE(p.metodo_pago, ${sqlQuote}-${sqlQuote}) AS metodo_pago, COALESCE(p.notas, ${sqlQuote}${sqlQuote}) AS notas,`,
        `p.total, STRING_AGG( ${sqlQuote}#${sqlQuote} || a.num_factura::text || ${sqlQuote} (${sqlQuote} ||`,
        `TO_CHAR(a.valor_abono, ${sqlQuote}FM999999990.00${sqlQuote}) || ${sqlQuote})${sqlQuote}, ${sqlQuote}, ${sqlQuote} ORDER BY`,
        'a.num_factura ) AS facturas FROM pagos p JOIN clientes cl ON cl.id =',
        'p.cliente_id LEFT JOIN abonos a ON a.pago_id = p.id GROUP BY p.id,',
        'cl.nombre ORDER BY p.fecha DESC, p.id DESC',
      ].join(' ')
    );
    expect(db.query.mock.calls[0][1]).toEqual([]);
  });

  test('findPagosForExport conserva filtro por rango de fechas', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await cuentasPagosRepository.findPagosForExport({
      fecha_inicio: '2024-01-01',
      fecha_fin: '2024-01-31',
    });

    expect(normalizeSql(db.query.mock.calls[0][0])).toContain('WHERE p.fecha BETWEEN $1 AND $2');
    expect(db.query.mock.calls[0][1]).toEqual(['2024-01-01', '2024-01-31']);
  });

  test('findPagosForExport conserva filtro por método de pago', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await cuentasPagosRepository.findPagosForExport({ metodo_pago: 'transferencia' });

    expect(normalizeSql(db.query.mock.calls[0][0])).toContain(
      `WHERE LOWER(COALESCE(p.metodo_pago, ${sqlQuote}${sqlQuote})) = $1`
    );
    expect(db.query.mock.calls[0][1]).toEqual(['transferencia']);
  });

  test('findPagosForExport conserva orden de placeholders con filtros combinados', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await cuentasPagosRepository.findPagosForExport({
      fecha_inicio: '2024-01-01',
      fecha_fin: '2024-01-31',
      metodo_pago: 'efectivo',
    });

    expect(normalizeSql(db.query.mock.calls[0][0])).toContain(
      `WHERE p.fecha BETWEEN $1 AND $2 AND LOWER(COALESCE(p.metodo_pago, ${sqlQuote}${sqlQuote})) = $3`
    );
    expect(db.query.mock.calls[0][1]).toEqual(['2024-01-01', '2024-01-31', 'efectivo']);
  });

  test('permite usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await cuentasPagosRepository.findPagosForExport({ metodo_pago: 'cheque' }, executor);

    expect(executor.query).toHaveBeenCalledTimes(1);
    expect(executor.query.mock.calls[0][1]).toEqual(['cheque']);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('propaga errores de base de datos sin transformarlos', async () => {
    const error = new Error('db down');
    db.query.mockRejectedValueOnce(error);

    await expect(cuentasPagosRepository.findPagosForExport()).rejects.toBe(error);
  });

  test('findPagoForDeletion conserva SQL, joins, JSON_AGG, filtro y parámetros', async () => {
    const expected = { rows: [{ id: 10, abonos: [] }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasPagosRepository.findPagoForDeletion(10);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      [
        'SELECT p.id, p.cliente_id, p.fecha, p.metodo_pago, p.referencia, p.notas, p.total,',
        'COALESCE( JSON_AGG( JSON_BUILD_OBJECT(',
        `${sqlQuote}id${sqlQuote}, a.id, ${sqlQuote}num_factura${sqlQuote}, a.num_factura,`,
        `${sqlQuote}fecha_abono${sqlQuote}, a.fecha_abono, ${sqlQuote}valor_abono${sqlQuote}, a.valor_abono`,
        ') ORDER BY a.id ) FILTER (WHERE a.id IS NOT NULL),',
        `${sqlQuote}[]${sqlQuote}::json ) AS abonos FROM pagos p LEFT JOIN abonos a ON a.pago_id = p.id`,
        'WHERE p.id = $1 GROUP BY p.id',
      ].join(' ')
    );
    expect(db.query.mock.calls[0][1]).toEqual([10]);
  });

  test('createPago conserva INSERT, columnas, placeholders, parámetros y RETURNING', async () => {
    const expected = { rows: [{ id: 10 }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasPagosRepository.createPago({
      clienteId: 7,
      fecha: '2024-01-01',
      metodoPago: 'efectivo',
      referencia: null,
      notas: 'Pago inicial',
      total: 500,
    });

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'INSERT INTO pagos (cliente_id, fecha, metodo_pago, referencia, notas, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id'
    );
    expect(db.query.mock.calls[0][1]).toEqual([
      7,
      '2024-01-01',
      'efectivo',
      null,
      'Pago inicial',
      500,
    ]);
  });

  test('updatePagoTotalFromAbonos conserva UPDATE, subquery y parámetros', async () => {
    const expected = { rows: [], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasPagosRepository.updatePagoTotalFromAbonos(10);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'UPDATE pagos SET total = (SELECT COALESCE(SUM(valor_abono), 0) FROM abonos WHERE pago_id = $1) WHERE id = $1'
    );
    expect(db.query.mock.calls[0][1]).toEqual([10]);
  });

  test('las escrituras de pagos permiten usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await cuentasPagosRepository.createPago(
      {
        clienteId: 7,
        fecha: '2024-01-01',
        metodoPago: null,
        referencia: null,
        notas: null,
        total: 500,
      },
      executor
    );
    await cuentasPagosRepository.updatePagoTotalFromAbonos(20, executor);

    expect(executor.query).toHaveBeenCalledTimes(2);
    expect(executor.query.mock.calls[0][1]).toEqual([7, '2024-01-01', null, null, null, 500]);
    expect(executor.query.mock.calls[1][0]).not.toMatch(/DELETE FROM/i);
    expect(executor.query.mock.calls[1][1]).toEqual([20]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('las escrituras de pagos propagan errores sin transformarlos', async () => {
    const error = new Error('delete failed');
    db.query.mockRejectedValueOnce(error);

    await expect(cuentasPagosRepository.updatePagoTotalFromAbonos(10)).rejects.toBe(error);
  });
});
