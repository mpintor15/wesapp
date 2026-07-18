jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const cuentasFacturasRepository = require('../repositories/cuentasFacturasRepository');

const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();

describe('cuentasFacturasRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findNextFacturaNumber conserva cálculo SQL y forma de retorno', async () => {
    const expected = { rows: [{ next_num: 42 }] };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.findNextFacturaNumber();

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT COALESCE(MAX(num_factura), 0) + 1 AS next_num FROM cuentas'
    );
    expect(db.query.mock.calls[0][1]).toBeUndefined();
  });

  test('findFacturaForUpdate conserva columnas, filtro y parámetros', async () => {
    const expected = {
      rowCount: 1,
      rows: [
        {
          num_factura: 1001,
          cancelada: false,
          cliente_id: 1,
          fecha_factura: '2024-01-01',
          valor_factura: '100.00',
          incluye_iva: false,
          incluye_retencion_fuente: false,
          incluye_retencion_iva: false,
        },
      ],
    };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.findFacturaForUpdate(1001);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT num_factura, cancelada, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva FROM cuentas WHERE num_factura = $1'
    );
    expect(db.query.mock.calls[0][1]).toEqual([1001]);
  });

  test('lockFacturasByNumeros conserva lock, ANY, parámetros y executor', async () => {
    const expected = { rows: [{ num_factura: 1001 }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.lockFacturasByNumeros([1001, 1002]);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'SELECT num_factura FROM cuentas WHERE num_factura = ANY($1::int[]) FOR UPDATE'
    );
    expect(db.query.mock.calls[0][1]).toEqual([[1001, 1002]]);
  });

  test('findFacturasForPaymentValidation conserva vista, aliases, filtro y parámetros', async () => {
    const expected = {
      rows: [{ num_factura: 1001, cliente_id: 7, cancelada: false, saldo_pendiente: '100.00' }],
    };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.findFacturasForPaymentValidation([1001]);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      [
        'SELECT c.num_factura, c.cliente_id, c.cancelada,',
        'COALESCE(v.saldo_pendiente, 0) AS saldo_pendiente',
        'FROM cuentas c LEFT JOIN vista_reporte_cuentas v ON v.num_factura = c.num_factura',
        'WHERE c.num_factura = ANY($1::int[])',
      ].join(' ')
    );
    expect(db.query.mock.calls[0][1]).toEqual([[1001]]);
  });

  test('permite usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [{ next_num: 1 }] }) };

    await cuentasFacturasRepository.findNextFacturaNumber(executor);

    expect(executor.query).toHaveBeenCalledWith(
      'SELECT COALESCE(MAX(num_factura), 0) + 1 AS next_num FROM cuentas'
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  test('lecturas batch de facturas permiten executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await cuentasFacturasRepository.lockFacturasByNumeros([1001], executor);
    await cuentasFacturasRepository.findFacturasForPaymentValidation([1001], executor);

    expect(executor.query).toHaveBeenCalledTimes(2);
    expect(executor.query.mock.calls[0][1]).toEqual([[1001]]);
    expect(executor.query.mock.calls[1][1]).toEqual([[1001]]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('propaga errores de base de datos sin transformarlos', async () => {
    const error = new Error('db down');
    db.query.mockRejectedValueOnce(error);

    await expect(cuentasFacturasRepository.findFacturaForUpdate(1001)).rejects.toBe(error);
  });

  test('createFactura conserva INSERT, columnas, placeholders, parámetros y RETURNING', async () => {
    const expected = { rows: [{ num_factura: 1001 }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.createFactura({
      numFactura: 1001,
      clienteId: 7,
      fechaFactura: '2024-01-01',
      valorFactura: 500,
      incluyeIva: true,
      incluyeRetencionFuente: false,
      incluyeRetencionIva: true,
    });

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva'
    );
    expect(db.query.mock.calls[0][1]).toEqual([1001, 7, '2024-01-01', 500, true, false, true]);
  });

  test('deleteFacturaByNumero conserva DELETE, WHERE, RETURNING y parámetros', async () => {
    const expected = { rows: [{ num_factura: 1001 }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.deleteFacturaByNumero(1001);

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'DELETE FROM cuentas WHERE num_factura = $1 RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva, cancelada, detalle_anulacion, fecha_anulacion'
    );
    expect(db.query.mock.calls[0][1]).toEqual([1001]);
  });

  test('cancelFacturaByNumero conserva UPDATE de anulación y parámetros', async () => {
    const expected = {
      rows: [{ num_factura: 1001, cancelada: true, detalle_anulacion: 'Duplicada' }],
      rowCount: 1,
    };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.cancelFacturaByNumero(1001, 'Duplicada');

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'UPDATE cuentas SET cancelada = TRUE, detalle_anulacion = $2, fecha_anulacion = CURRENT_TIMESTAMP WHERE num_factura = $1 RETURNING num_factura, cancelada, detalle_anulacion, fecha_anulacion'
    );
    expect(db.query.mock.calls[0][1]).toEqual([1001, 'Duplicada']);
  });

  test('updateFacturaByNumero conserva UPDATE de edición, RETURNING y parámetros', async () => {
    const expected = { rows: [{ num_factura: 1001 }], rowCount: 1 };
    db.query.mockResolvedValueOnce(expected);

    const result = await cuentasFacturasRepository.updateFacturaByNumero({
      numFactura: 1001,
      clienteId: 8,
      fechaFactura: '2024-02-01',
      valorFactura: 750,
      incluyeIva: false,
      incluyeRetencionFuente: true,
      incluyeRetencionIva: false,
    });

    expect(result).toBe(expected);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(normalizeSql(db.query.mock.calls[0][0])).toBe(
      'UPDATE cuentas SET cliente_id = $2, fecha_factura = $3, valor_factura = $4, incluye_iva = $5, incluye_retencion_fuente = $6, incluye_retencion_iva = $7 WHERE num_factura = $1 RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva'
    );
    expect(db.query.mock.calls[0][1]).toEqual([1001, 8, '2024-02-01', 750, false, true, false]);
  });

  test('las escrituras permiten usar un executor explícito', async () => {
    const executor = { query: jest.fn().mockResolvedValue({ rows: [{ num_factura: 1001 }] }) };

    const result = await cuentasFacturasRepository.deleteFacturaByNumero(1001, executor);

    expect(result).toBe(await executor.query.mock.results[0].value);
    expect(executor.query).toHaveBeenCalledTimes(1);
    expect(executor.query.mock.calls[0][1]).toEqual([1001]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('las escrituras propagan errores de base de datos sin transformarlos', async () => {
    const error = new Error('duplicate');
    db.query.mockRejectedValueOnce(error);

    await expect(
      cuentasFacturasRepository.createFactura({
        numFactura: 1001,
        clienteId: 7,
        fechaFactura: '2024-01-01',
        valorFactura: 500,
        incluyeIva: true,
        incluyeRetencionFuente: false,
        incluyeRetencionIva: true,
      })
    ).rejects.toBe(error);
  });
});
