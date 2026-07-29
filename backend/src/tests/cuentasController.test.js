/**
 * Tests para cuentasController
 *
 * Cubre los flujos críticos de negocio usando mocks de la DB:
 * - createBatchAbono: valida cliente, factura anulada y exceso de saldo
 * - createFactura: validaciones básicas de campos
 * - getNextNumFactura: retorna el siguiente número correcto
 * - cancelFactura: validaciones de estado
 * - updateFactura: gerente edita factura activa
 * - deleteAbono: rechaza eliminación física de abonos
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn().mockReturnValue({
    usuario_id: 1,
    usuario_nombre: 'test',
    ip_address: '127.0.0.1',
    user_agent: 'jest',
  }),
}));

const db = require('../config/database');
const { logAudit } = require('../utils/audit');
const {
  createBatchAbono,
  createCliente,
  createFactura,
  deleteCliente,
  deleteFactura,
  deletePago,
  voidPago,
  exportPagosExcel,
  getPagos,
  getAbonosByFactura,
  getClientes,
  getReporte,
  getNextNumFactura,
  cancelFactura,
  updateFactura,
  deleteAbono,
} = require('../controllers/cuentasController');

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  user: { id: 1, usuario: 'gerente1', tipo_usuario: 'gerente' },
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('jest-agent'),
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clientes de Cuentas', () => {
  test('getClientes expone solo clientes activos para operaciones de Cuentas', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'Cliente Cuentas', identificacion: '099001', estado: 'activo' }],
      rowCount: 1,
    });
    const req = mockReq();
    const res = mockRes();

    await getClientes(req, res);

    expect(db.query).toHaveBeenCalledWith(
      'SELECT id, nombre, identificacion, estado FROM clientes WHERE estado = $1 ORDER BY nombre ASC',
      ['activo']
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1, nombre: 'Cliente Cuentas', identificacion: '099001', estado: 'activo' }],
    });
  });

  test('createCliente de Cuentas sigue requiriendo identificación', async () => {
    const req = mockReq({ body: { nombre: 'Cliente sin identificación' } });
    const res = mockRes();

    await createCliente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'La identificación del cliente es requerida',
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('createCliente de Cuentas mantiene request y response históricos', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 7, nombre: 'Cliente Cuentas', identificacion: '099001' }],
      rowCount: 1,
    });
    const req = mockReq({
      body: { nombre: '  Cliente Cuentas  ', identificacion: ' 099001 ' },
    });
    const res = mockRes();

    await createCliente(req, res);

    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO clientes (nombre, identificacion) VALUES ($1, $2) RETURNING id, nombre, identificacion',
      ['Cliente Cuentas', '099001']
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Cliente creado exitosamente',
      data: { id: 7, nombre: 'Cliente Cuentas', identificacion: '099001' },
    });
  });
});

// ============================================
// createBatchAbono
// ============================================

describe('createBatchAbono', () => {
  test('rechaza si abonos está vacío', async () => {
    const req = mockReq({
      body: { cliente_id: 1, fecha: '2024-01-01', abonos: [] },
    });
    const res = mockRes();
    await createBatchAbono(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si falta cliente_id', async () => {
    const req = mockReq({
      body: { fecha: '2024-01-01', abonos: [{ num_factura: 1001, valor_abono: 100 }] },
    });
    const res = mockRes();
    await createBatchAbono(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si alguna factura está anulada', async () => {
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, estado: 'activo' }] }) // cliente activo
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ num_factura: 1001 }] }) // bloqueo
          .mockResolvedValueOnce({
            rows: [
              { num_factura: 1001, cliente_id: 1, cancelada: true, saldo_pendiente: '500.00' },
            ],
          }), // facturas
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 100 }],
      },
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('anulada') })
    );
  });

  test('rechaza si algún pago excede el saldo', async () => {
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, estado: 'activo' }] }) // cliente activo
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ num_factura: 1001 }] }) // bloqueo
          .mockResolvedValueOnce({
            rows: [
              { num_factura: 1001, cliente_id: 1, cancelada: false, saldo_pendiente: '100.00' },
            ],
          }),
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 500 }],
      },
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('saldo pendiente') })
    );
  });

  test('registra todos los pagos si los datos son válidos', async () => {
    let transactionClient;
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, estado: 'activo' }] }) // cliente activo
          .mockResolvedValueOnce({
            rowCount: 2,
            rows: [{ num_factura: 1001 }, { num_factura: 1002 }],
          }) // bloqueo
          .mockResolvedValueOnce({
            rows: [
              { num_factura: 1001, cliente_id: 1, cancelada: false, saldo_pendiente: '1000.00' },
              { num_factura: 1002, cliente_id: 1, cancelada: false, saldo_pendiente: '2000.00' },
            ],
          }) // facturas
          .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT pagos
          .mockResolvedValueOnce({ rows: [] }) // INSERT abono 1
          .mockResolvedValueOnce({ rows: [] }), // INSERT abono 2
      };
      transactionClient = fakeClient;
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [
          { num_factura: 1001, valor_abono: 200 },
          { num_factura: 1002, valor_abono: 300 },
        ],
      },
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining('2') })
    );
    expect(db.query).not.toHaveBeenCalled();
    expect(transactionClient.query).toHaveBeenCalledTimes(6);
    expect(transactionClient.query.mock.calls[0][0]).toMatch(/FROM clientes/);
    expect(transactionClient.query.mock.calls[0][0]).toMatch(/estado/);
    expect(transactionClient.query.mock.calls[1][0]).toMatch(/FOR UPDATE/);
    expect(transactionClient.query.mock.calls[1][1]).toEqual([[1001, 1002]]);
    expect(transactionClient.query.mock.calls[2][0]).toMatch(/vista_reporte_cuentas/);
    expect(transactionClient.query.mock.calls[2][1]).toEqual([[1001, 1002]]);
    expect(transactionClient.query.mock.calls[3][0]).toBe(
      'INSERT INTO pagos (cliente_id, fecha, metodo_pago, referencia, notas, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id'
    );
    expect(transactionClient.query.mock.calls[4][0]).toBe(
      'INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3, $4)'
    );
    expect(transactionClient.query.mock.calls[5][0]).toBe(
      'INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3, $4)'
    );
  });

  test('rechaza pago por lote con cliente inactivo', async () => {
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest.fn().mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1, nombre: 'Cliente Inactivo', estado: 'inactivo' }],
        }),
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 100 }],
      },
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLIENT_INACTIVE' }));
  });
});

// ============================================
// createFactura
// ============================================

describe('createFactura', () => {
  test('rechaza si faltan campos requeridos', async () => {
    const req = mockReq({ body: { num_factura: 1001 } });
    const res = mockRes();
    await createFactura(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si valor_factura es 0', async () => {
    const req = mockReq({
      body: { num_factura: 1001, cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 0 },
    });
    const res = mockRes();
    await createFactura(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si incluye_retencion_iva=true pero incluye_iva=false', async () => {
    const req = mockReq({
      body: {
        num_factura: 1001,
        cliente_id: 1,
        fecha_factura: '2024-01-01',
        valor_factura: 1000,
        incluye_iva: false,
        incluye_retencion_iva: true,
      },
    });
    const res = mockRes();
    await createFactura(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('crea la factura con datos válidos', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({
        query: jest
          .fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, estado: 'activo' }] })
          .mockResolvedValueOnce({
            rows: [
              {
                num_factura: 1001,
                cliente_id: 1,
                fecha_factura: '2024-01-01',
                valor_factura: 5000,
                incluye_iva: true,
                incluye_retencion_fuente: true,
                incluye_retencion_iva: true,
                cancelada: false,
              },
            ],
          }),
      })
    );

    const req = mockReq({
      body: {
        num_factura: 1001,
        cliente_id: 1,
        fecha_factura: '2024-01-01',
        valor_factura: 5000,
        incluye_iva: true,
        incluye_retencion_fuente: true,
        incluye_retencion_iva: true,
      },
    });
    const res = mockRes();
    await createFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rechaza factura con cliente inactivo', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({
        query: jest.fn().mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1, estado: 'inactivo' }],
        }),
      })
    );

    const req = mockReq({
      body: {
        num_factura: 1001,
        cliente_id: 1,
        fecha_factura: '2024-01-01',
        valor_factura: 5000,
      },
    });
    const res = mockRes();
    await createFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLIENT_INACTIVE' }));
  });
});

// ============================================
// getAbonosByFactura
// ============================================

describe('getAbonosByFactura', () => {
  test('retorna abonos de una factura', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          pago_id: 10,
          fecha_abono: '2024-01-02',
          valor_abono: '100.00',
          fecha_pago: '2024-01-02',
          metodo_pago: 'efectivo',
          referencia: null,
          notas: '',
          pago_total: '100.00',
          pago_facturas_count: '1',
        },
      ],
    });

    const req = mockReq({ params: { num_factura: '1001' } });
    const res = mockRes();
    await getAbonosByFactura(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          id: 1,
          pago_id: 10,
          valor_abono: '100.00',
        }),
      ],
    });
  });

  test('retorna lista vacía cuando la factura no tiene abonos', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { num_factura: '1001' } });
    const res = mockRes();
    await getAbonosByFactura(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  test('retorna 400 si el número de factura es inválido', async () => {
    const req = mockReq({ params: { num_factura: 'abc' } });
    const res = mockRes();
    await getAbonosByFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('retorna error controlado si falla la base de datos', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));

    const req = mockReq({ params: { num_factura: '1001' } });
    const res = mockRes();
    await getAbonosByFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Error en el servidor' })
    );
  });
});

describe('getPagos', () => {
  test('detalle histórico de pago marca anuladas y no muestra saldo cobrable', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    db.query.mockResolvedValueOnce({ rows: [{ table_name: 'pagos' }], rowCount: 1 });
    Array.from({ length: 12 }).forEach(() => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: true }], rowCount: 1 });
    });
    db.query.mockResolvedValueOnce({ rows: [] });

    const req = mockReq();
    const res = mockRes();
    await getPagos(req, res);

    const query = db.query.mock.calls.find((call) => call[0].includes('FROM pagos p'))[0];
    expect(query).toMatch(/'cancelada', c\.cancelada/);
    expect(query).toContain('WHEN c.cancelada THEN 0');
    expect(query).not.toMatch(/DELETE FROM/i);
  });
});

// ============================================
// getNextNumFactura
// ============================================

describe('getNextNumFactura', () => {
  test('retorna MAX(num_factura) + 1', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ next_num: 1007 }] });

    const req = mockReq();
    const res = mockRes();
    await getNextNumFactura(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { next_num_factura: 1007 } })
    );
  });

  test('retorna 1 cuando la tabla está vacía', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ next_num: 1 }] });

    const req = mockReq();
    const res = mockRes();
    await getNextNumFactura(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { next_num_factura: 1 } })
    );
  });

  test('retorna error controlado si falla la base de datos', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));

    const req = mockReq();
    const res = mockRes();
    await getNextNumFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Error en el servidor' })
    );
  });
});

// ============================================
// cancelFactura
// ============================================

describe('cancelFactura', () => {
  test('retorna 404 si la factura no existe', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({ query: jest.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] }) })
    );

    const req = mockReq({
      params: { num_factura: '9999' },
      body: { detalle_anulacion: 'Error de prueba' },
    });
    const res = mockRes();
    await cancelFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rechaza si falta detalle_anulacion', async () => {
    const req = mockReq({
      params: { num_factura: '1001' },
      body: {},
    });
    const res = mockRes();
    await cancelFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('anula factura sin borrar abonos y registra auditoría', async () => {
    let transactionClient;
    db.transaction.mockImplementationOnce(async (callback) => {
      transactionClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                num_factura: 1001,
                cancelada: false,
                cliente_id: 1,
                fecha_factura: '2024-01-01',
                valor_factura: 500,
              },
            ],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                num_factura: 1001,
                cancelada: true,
                detalle_anulacion: 'Error de emisión',
                fecha_anulacion: '2024-01-02T00:00:00.000Z',
              },
            ],
          }),
      };
      return callback(transactionClient);
    });

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { detalle_anulacion: 'Error de emisión' },
    });
    const res = mockRes();
    await cancelFactura(req, res);

    const sql = transactionClient.query.mock.calls.map((call) => call[0]).join('\n');
    expect(sql).toMatch(/FOR UPDATE/i);
    expect(sql).toMatch(/UPDATE cuentas/i);
    expect(sql).not.toMatch(/DELETE FROM (cuentas|abonos|pagos)/i);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Factura anulada exitosamente',
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        tabla: 'cuentas',
        operacion: 'UPDATE',
        datos_anteriores: expect.objectContaining({ cancelada: false }),
        datos_nuevos: expect.objectContaining({ cancelada: true }),
      })
    );
  });

  test('anulación repetida devuelve 409 y no modifica factura', async () => {
    let transactionClient;
    db.transaction.mockImplementationOnce(async (callback) => {
      transactionClient = {
        query: jest.fn().mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ num_factura: 1001, cancelada: true }],
        }),
      };
      return callback(transactionClient);
    });

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { detalle_anulacion: 'Otro motivo' },
    });
    const res = mockRes();
    await cancelFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVOICE_ALREADY_VOIDED' })
    );
    expect(transactionClient.query).toHaveBeenCalledTimes(1);
    expect(logAudit).not.toHaveBeenCalled();
  });
});

// ============================================
// deleteFactura
// ============================================

describe('deleteFactura', () => {
  test('retorna 404 si la factura no existe', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req = mockReq({ params: { num_factura: '9999' } });
    const res = mockRes();
    await deleteFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(logAudit).not.toHaveBeenCalled();
  });

  test('rechaza eliminación física sin borrar cuentas', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ num_factura: 1001 }] });

    const req = mockReq({ params: { num_factura: '1001' } });
    const res = mockRes();
    await deleteFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVOICE_CANNOT_BE_VOIDED' })
    );
    expect(db.query.mock.calls.map((call) => call[0]).join('\n')).not.toMatch(/DELETE FROM/i);
    expect(logAudit).not.toHaveBeenCalled();
  });
});

// ============================================
// updateFactura
// ============================================

describe('updateFactura', () => {
  test('rechaza editar una factura anulada', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({
        query: jest.fn().mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ num_factura: 1001, cancelada: true, cliente_id: 1, valor_factura: 5000 }],
        }),
      })
    );

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 6000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVOICE_ALREADY_VOIDED',
        message: expect.stringContaining('anulada'),
      })
    );
  });

  test('retorna 404 si la factura no existe', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({ query: jest.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] }) })
    );

    const req = mockReq({
      params: { num_factura: '9999' },
      body: { cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 5000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('actualiza factura activa correctamente', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                num_factura: 1001,
                cancelada: false,
                cliente_id: 1,
                fecha_factura: '2024-01-01',
                valor_factura: 5000,
                incluye_iva: false,
                incluye_retencion_fuente: false,
                incluye_retencion_iva: false,
              },
            ],
          })
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, estado: 'activo' }] })
          .mockResolvedValueOnce({
            rows: [
              {
                num_factura: 1001,
                cliente_id: 1,
                fecha_factura: '2024-06-01',
                valor_factura: 6000,
                incluye_iva: false,
                incluye_retencion_fuente: false,
                incluye_retencion_iva: false,
              },
            ],
          }),
      })
    );

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 1, fecha_factura: '2024-06-01', valor_factura: 6000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('rechaza cambio de factura hacia cliente inactivo', async () => {
    db.transaction.mockImplementationOnce(async (callback) =>
      callback({
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ num_factura: 1001, cancelada: false, cliente_id: 1 }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id: 2, estado: 'inactivo' }],
          }),
      })
    );

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 2, fecha_factura: '2024-06-01', valor_factura: 6000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLIENT_INACTIVE' }));
  });
});

// ============================================
// deleteAbono
// ============================================

describe('deleteAbono', () => {
  test('retorna 404 si el abono no existe', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rechaza eliminación física y conserva abono/pago', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 5, pago_id: 10, num_factura: 1001, valor_abono: 200 }],
    });

    const req = mockReq({ params: { id: '5' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PAYMENT_CANNOT_BE_VOIDED' })
    );
    expect(db.query.mock.calls.map((call) => call[0]).join('\n')).not.toMatch(/DELETE FROM/i);
    expect(logAudit).not.toHaveBeenCalled();
  });
});

// ============================================
// deletePago
// ============================================

describe('deletePago', () => {
  test('retorna 404 si el pago no existe', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await deletePago(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(logAudit).not.toHaveBeenCalled();
  });

  test('rechaza eliminación física y conserva pago/abonos', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] });

    const req = mockReq({ params: { id: '10' } });
    const res = mockRes();
    await deletePago(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PAYMENT_CANNOT_BE_VOIDED' })
    );
    expect(db.query.mock.calls.map((call) => call[0]).join('\n')).not.toMatch(/DELETE FROM/i);
    expect(logAudit).not.toHaveBeenCalled();
  });

  test('retorna error controlado si falla la base de datos', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));

    const req = mockReq({ params: { id: '10' } });
    const res = mockRes();
    await deletePago(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(logAudit).not.toHaveBeenCalled();
  });

  test('voidPago comparte la misma política no destructiva', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10 }] });

    const req = mockReq({ params: { id: '10' } });
    const res = mockRes();
    await voidPago(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PAYMENT_CANNOT_BE_VOIDED' })
    );
    expect(db.query.mock.calls.map((call) => call[0]).join('\n')).not.toMatch(/DELETE FROM/i);
  });
});

describe('reportes de Cuentas', () => {
  test('reporte histórico conserva anuladas pero no las expone como deuda cobrable', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('information_schema.columns')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      return {
        rows: [
          {
            num_factura: 1001,
            cancelada: true,
            por_cobrar: '0',
            total_abonos: '25.00',
            saldo_pendiente: '0',
          },
        ],
      };
    });

    const req = mockReq();
    const res = mockRes();
    await getReporte(req, res);

    const reportSql = db.query.mock.calls
      .map((call) => call[0])
      .find((sql) => sql.includes('vista_reporte_cuentas'));
    expect(reportSql).toContain(
      'CASE WHEN COALESCE(v.cancelada, FALSE) THEN 0 ELSE v.por_cobrar END AS por_cobrar'
    );
    expect(reportSql).toContain(
      'CASE WHEN COALESCE(v.cancelada, FALSE) THEN 0 ELSE v.saldo_pendiente END AS saldo_pendiente'
    );
    expect(reportSql).toContain('v.total_abonos');
    expect(reportSql).not.toContain('WHERE COALESCE(v.cancelada, FALSE) = FALSE');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [
          {
            num_factura: 1001,
            cancelada: true,
            por_cobrar: '0',
            total_abonos: '25.00',
            saldo_pendiente: '0',
          },
        ],
        pagination: expect.objectContaining({
          page: 1,
          pageSize: 25,
        }),
      })
    );
  });

  test('solo_deudores excluye anuladas de cuentas pendientes', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('information_schema.columns')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      return { rows: [] };
    });

    const req = mockReq({ query: { solo_deudores: 'true' } });
    const res = mockRes();
    await getReporte(req, res);

    const reportSql = db.query.mock.calls
      .map((call) => call[0])
      .find((sql) => sql.includes('vista_reporte_cuentas'));
    expect(reportSql).toContain('COALESCE(cancelada, FALSE) = FALSE');
    expect(reportSql).toContain('saldo_pendiente > 0');
  });
});

describe('validación de entrada en Cuentas', () => {
  test('deleteCliente rechaza ID alfanumérico con 400 sin consultar DB', async () => {
    const req = mockReq({ params: { id: '12abc' } });
    const res = mockRes();

    await deleteCliente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('deleteFactura rechaza ID decimal con 400 sin consultar DB', async () => {
    const req = mockReq({ params: { num_factura: '1.5' } });
    const res = mockRes();

    await deleteFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('getReporte rechaza fecha imposible antes de introspección SQL', async () => {
    const req = mockReq({ query: { fecha_inicio: '2026-02-30', fecha_fin: '2026-03-01' } });
    const res = mockRes();

    await getReporte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('getReporte rechaza rango invertido antes de consultar DB', async () => {
    const req = mockReq({ query: { fecha_inicio: '2026-03-01', fecha_fin: '2026-02-01' } });
    const res = mockRes();

    await getReporte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('getReporte rechaza boolean filter inválido antes de consultar DB', async () => {
    const req = mockReq({ query: { solo_deudores: 'si' } });
    const res = mockRes();

    await getReporte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('exportPagosExcel rechaza método de pago inválido antes de consultar DB', async () => {
    const req = mockReq({ query: { metodo_pago: 'tarjeta' } });
    const res = mockRes();

    await exportPagosExcel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });
});
