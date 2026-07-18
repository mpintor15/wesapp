/**
 * Tests para cuentasController
 *
 * Cubre los flujos críticos de negocio usando mocks de la DB:
 * - createBatchAbono: valida cliente, factura anulada y exceso de saldo
 * - createFactura: validaciones básicas de campos
 * - getNextNumFactura: retorna el siguiente número correcto
 * - cancelFactura: validaciones de estado
 * - updateFactura: gerente edita factura activa
 * - deleteAbono: gerente elimina abono
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
  createFactura,
  deleteCliente,
  deleteFactura,
  deletePago,
  exportPagosExcel,
  getAbonosByFactura,
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
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
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
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
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
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
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
    expect(transactionClient.query.mock.calls[0][0]).toBe(
      'SELECT id FROM clientes WHERE id = $1 LIMIT 1'
    );
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
    db.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
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
      });

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
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

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

  test('elimina factura existente y conserva auditoría', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          num_factura: 1001,
          cliente_id: 1,
          fecha_factura: '2024-01-01',
          valor_factura: 500,
          incluye_iva: false,
          incluye_retencion_fuente: false,
          incluye_retencion_iva: false,
          cancelada: false,
          detalle_anulacion: null,
          fecha_anulacion: null,
        },
      ],
    });

    const req = mockReq({ params: { num_factura: '1001' } });
    const res = mockRes();
    await deleteFactura(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Factura eliminada exitosamente',
    });
    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        tabla: 'cuentas',
        operacion: 'DELETE',
        registro_id: '1001',
        datos_anteriores: expect.objectContaining({ num_factura: 1001 }),
      })
    );
  });
});

// ============================================
// updateFactura
// ============================================

describe('updateFactura', () => {
  test('rechaza editar una factura anulada', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ num_factura: 1001, cancelada: true, cliente_id: 1, valor_factura: 5000 }],
    });

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 6000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('anulada') })
    );
  });

  test('retorna 404 si la factura no existe', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req = mockReq({
      params: { num_factura: '9999' },
      body: { cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 5000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('actualiza factura activa correctamente', async () => {
    db.query
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
      });

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 1, fecha_factura: '2024-06-01', valor_factura: 6000 },
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
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

  test('elimina el abono y el pago si no quedan más abonos', async () => {
    let transactionClient;
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 5, pago_id: 10, num_factura: 1001, valor_abono: 200 }],
    });

    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // DELETE abono
          .mockResolvedValueOnce({ rows: [{ cnt: '0' }] }) // COUNT remaining
          .mockResolvedValueOnce({ rows: [] }), // DELETE pago
      };
      transactionClient = fakeClient;
      await callback(fakeClient);
    });

    const req = mockReq({ params: { id: '5' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(transactionClient.query).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM abonos WHERE id = $1',
      [5]
    );
    expect(transactionClient.query).toHaveBeenNthCalledWith(
      2,
      'SELECT COUNT(*) AS cnt FROM abonos WHERE pago_id = $1',
      [10]
    );
    expect(transactionClient.query).toHaveBeenNthCalledWith(
      3,
      'DELETE FROM pagos WHERE id = $1',
      [10]
    );
  });

  test('actualiza el total del pago si quedan otros abonos', async () => {
    let transactionClient;
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 5, pago_id: 10, num_factura: 1001, valor_abono: 200 }],
    });

    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // DELETE abono
          .mockResolvedValueOnce({ rows: [{ cnt: '2' }] }) // COUNT remaining
          .mockResolvedValueOnce({ rows: [] }), // UPDATE pago total
      };
      transactionClient = fakeClient;
      await callback(fakeClient);
    });

    const req = mockReq({ params: { id: '5' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(transactionClient.query).toHaveBeenNthCalledWith(
      3,
      'UPDATE pagos SET total = (SELECT COALESCE(SUM(valor_abono), 0) FROM abonos WHERE pago_id = $1) WHERE id = $1',
      [10]
    );
  });

  test('retorna error controlado si falla la transacción', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 5, pago_id: 10, num_factura: 1001, valor_abono: 200 }],
    });
    db.transaction.mockRejectedValueOnce(new Error('tx down'));

    const req = mockReq({ params: { id: '5' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
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

  test('elimina pago existente y conserva auditoría', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 10,
            cliente_id: 1,
            fecha: '2024-01-01',
            metodo_pago: 'efectivo',
            referencia: null,
            notas: null,
            total: 200,
            abonos: [{ id: 5, num_factura: 1001, valor_abono: 200 }],
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const req = mockReq({ params: { id: '10' } });
    const res = mockRes();
    await deletePago(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Pago eliminado exitosamente',
    });
    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        tabla: 'pagos',
        operacion: 'DELETE',
        registro_id: '10',
        datos_anteriores: expect.objectContaining({ id: 10 }),
      })
    );
  });

  test('retorna error controlado si falla la base de datos', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));

    const req = mockReq({ params: { id: '10' } });
    const res = mockRes();
    await deletePago(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(logAudit).not.toHaveBeenCalled();
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
