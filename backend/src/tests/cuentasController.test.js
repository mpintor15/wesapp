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
  transaction: jest.fn()
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn().mockReturnValue({
    usuario_id: 1,
    usuario_nombre: 'test',
    ip_address: '127.0.0.1',
    user_agent: 'jest'
  })
}));

const db = require('../config/database');
const {
  createBatchAbono,
  createFactura,
  getNextNumFactura,
  cancelFactura,
  updateFactura,
  deleteAbono
} = require('../controllers/cuentasController');

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  user: { id: 1, usuario: 'gerente1', tipo_usuario: 'gerente' },
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('jest-agent'),
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockImplementation((query) => {
    const sql = String(query);
    if (sql.includes('to_regclass')) {
      return Promise.resolve({ rows: [{ table_name: 'pagos' }], rowCount: 1 });
    }
    if (sql.includes('information_schema.columns')) {
      return Promise.resolve({ rows: [{ exists: 1 }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
});

// ============================================
// createBatchAbono
// ============================================

describe('createBatchAbono', () => {
  test('rechaza si abonos está vacío', async () => {
    const req = mockReq({
      body: { cliente_id: 1, fecha: '2024-01-01', abonos: [] }
    });
    const res = mockRes();
    await createBatchAbono(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si falta cliente_id', async () => {
    const req = mockReq({
      body: { fecha: '2024-01-01', abonos: [{ num_factura: 1001, valor_abono: 100 }] }
    });
    const res = mockRes();
    await createBatchAbono(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si alguna factura está anulada', async () => {
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
          .mockResolvedValueOnce({
            rows: [{ num_factura: 1001, cliente_id: 1, cancelada: true, saldo_pendiente: '500.00' }]
          }) // facturas
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 100 }]
      }
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
        query: jest.fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
          .mockResolvedValueOnce({
            rows: [{ num_factura: 1001, cliente_id: 1, cancelada: false, saldo_pendiente: '100.00' }]
          })
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 500 }]
      }
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('saldo pendiente') })
    );
  });

  test('registra todos los pagos si los datos son válidos', async () => {
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
          .mockResolvedValueOnce({
            rows: [
              { num_factura: 1001, cliente_id: 1, cancelada: false, saldo_pendiente: '1000.00' },
              { num_factura: 1002, cliente_id: 1, cancelada: false, saldo_pendiente: '2000.00' }
            ]
          }) // facturas
          .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT pagos
          .mockResolvedValueOnce({ rows: [] }) // INSERT abono 1
          .mockResolvedValueOnce({ rows: [] }) // INSERT abono 2
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [
          { num_factura: 1001, valor_abono: 200 },
          { num_factura: 1002, valor_abono: 300 }
        ]
      }
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining('2') })
    );
  });

  test('registra abonos en esquema legacy sin tabla pagos ni pago_id', async () => {
    db.query.mockImplementation((query) => {
      const sql = String(query);
      if (sql.includes('to_regclass')) {
        return Promise.resolve({ rows: [{ table_name: null }], rowCount: 1 });
      }
      if (sql.includes('information_schema.columns')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    let fakeClient;
    db.transaction.mockImplementation(async (callback) => {
      fakeClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
          .mockResolvedValueOnce({
            rows: [
              { num_factura: 1001, cliente_id: 1, cancelada: false, saldo_pendiente: '1000.00' }
            ]
          })
          .mockResolvedValueOnce({ rows: [] })
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 200 }]
      }
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(fakeClient.query).toHaveBeenLastCalledWith(
      'INSERT INTO abonos (num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3)',
      [1001, '2024-01-01', 200]
    );
  });

  test('registra pagos aunque falte la vista de reporte y columnas nuevas de cuentas', async () => {
    db.query.mockImplementation((query, params) => {
      const sql = String(query);
      if (sql.includes('to_regclass')) {
        const relation = params?.[0];
        return Promise.resolve({
          rows: [{ table_name: relation === 'public.pagos' ? 'pagos' : null }],
          rowCount: 1
        });
      }
      if (sql.includes('information_schema.columns')) {
        const table = params?.[0];
        const column = params?.[1];
        const existingColumns = new Set([
          'abonos:pago_id',
          'pagos:cliente_id',
          'pagos:fecha',
          'pagos:metodo_pago',
          'pagos:referencia',
          'pagos:notas',
          'pagos:total'
        ]);
        const exists = existingColumns.has(`${table}:${column}`);
        return Promise.resolve({ rows: exists ? [{ exists: 1 }] : [], rowCount: exists ? 1 : 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    let facturasQuery = '';
    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
          .mockImplementationOnce((query) => {
            facturasQuery = String(query);
            return Promise.resolve({
              rows: [
                { num_factura: 1001, cliente_id: 1, cancelada: false, saldo_pendiente: '1000.00' }
              ]
            });
          })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce({ rows: [] })
      };
      await callback(fakeClient);
    });

    const req = mockReq({
      body: {
        cliente_id: 1,
        fecha: '2024-01-01',
        abonos: [{ num_factura: 1001, valor_abono: 200 }]
      }
    });
    const res = mockRes();
    await createBatchAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(facturasQuery).not.toContain('vista_reporte_cuentas');
    expect(facturasQuery).not.toContain('c.cancelada');
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
      body: { num_factura: 1001, cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 0 }
    });
    const res = mockRes();
    await createFactura(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza si incluye_retencion_iva=true pero incluye_iva=false', async () => {
    const req = mockReq({
      body: {
        num_factura: 1001, cliente_id: 1, fecha_factura: '2024-01-01',
        valor_factura: 1000, incluye_iva: false, incluye_retencion_iva: true
      }
    });
    const res = mockRes();
    await createFactura(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('crea la factura con datos válidos', async () => {
    db.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // cliente existe
      .mockResolvedValueOnce({
        rows: [{
          num_factura: 1001, cliente_id: 1, fecha_factura: '2024-01-01',
          valor_factura: 5000, incluye_iva: true, incluye_retencion_fuente: true,
          incluye_retencion_iva: true, cancelada: false
        }]
      });

    const req = mockReq({
      body: {
        num_factura: 1001, cliente_id: 1, fecha_factura: '2024-01-01',
        valor_factura: 5000, incluye_iva: true, incluye_retencion_fuente: true,
        incluye_retencion_iva: true
      }
    });
    const res = mockRes();
    await createFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
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
});

// ============================================
// cancelFactura
// ============================================

describe('cancelFactura', () => {
  test('retorna 404 si la factura no existe', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req = mockReq({
      params: { num_factura: '9999' },
      body: { detalle_anulacion: 'Error de prueba' }
    });
    const res = mockRes();
    await cancelFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rechaza si falta detalle_anulacion', async () => {
    const req = mockReq({
      params: { num_factura: '1001' },
      body: {}
    });
    const res = mockRes();
    await cancelFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================
// updateFactura
// ============================================

describe('updateFactura', () => {
  test('rechaza editar una factura anulada', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ num_factura: 1001, cancelada: true, cliente_id: 1, valor_factura: 5000 }]
    });

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 6000 }
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
      body: { cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 5000 }
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('actualiza factura activa correctamente', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ num_factura: 1001, cancelada: false, cliente_id: 1, fecha_factura: '2024-01-01', valor_factura: 5000, incluye_iva: false, incluye_retencion_fuente: false, incluye_retencion_iva: false }]
      })
      .mockResolvedValueOnce({
        rows: [{ num_factura: 1001, cliente_id: 1, fecha_factura: '2024-06-01', valor_factura: 6000, incluye_iva: false, incluye_retencion_fuente: false, incluye_retencion_iva: false }]
      });

    const req = mockReq({
      params: { num_factura: '1001' },
      body: { cliente_id: 1, fecha_factura: '2024-06-01', valor_factura: 6000 }
    });
    const res = mockRes();
    await updateFactura(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});

// ============================================
// deleteAbono
// ============================================

describe('deleteAbono', () => {
  test('retorna 404 si el abono no existe', async () => {
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('elimina el abono y el pago si no quedan más abonos', async () => {
    db.query.mockImplementation((query) => {
      const sql = String(query);
      if (sql.includes('to_regclass')) {
        return Promise.resolve({ rows: [{ table_name: 'pagos' }], rowCount: 1 });
      }
      if (sql.includes('information_schema.columns')) {
        return Promise.resolve({ rows: [{ exists: 1 }], rowCount: 1 });
      }
      if (sql.includes('FROM abonos WHERE id = $1')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [{ id: 5, pago_id: 10, num_factura: 1001, valor_abono: 200 }]
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    db.transaction.mockImplementation(async (callback) => {
      const fakeClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // DELETE abono
          .mockResolvedValueOnce({ rows: [{ cnt: '0' }] }) // COUNT remaining
          .mockResolvedValueOnce({ rows: [] }) // DELETE pago
      };
      await callback(fakeClient);
    });

    const req = mockReq({ params: { id: '5' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  test('elimina un abono en esquema legacy sin pago_id', async () => {
    db.query.mockImplementation((query) => {
      const sql = String(query);
      if (sql.includes('to_regclass')) {
        return Promise.resolve({ rows: [{ table_name: null }], rowCount: 1 });
      }
      if (sql.includes('information_schema.columns')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (sql.includes('FROM abonos WHERE id = $1')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [{ id: 5, pago_id: null, num_factura: 1001, valor_abono: 200 }]
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    let fakeClient;
    db.transaction.mockImplementation(async (callback) => {
      fakeClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] })
      };
      await callback(fakeClient);
    });

    const req = mockReq({ params: { id: '5' } });
    const res = mockRes();
    await deleteAbono(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
    expect(fakeClient.query).toHaveBeenCalledTimes(1);
    expect(fakeClient.query).toHaveBeenCalledWith('DELETE FROM abonos WHERE id = $1', [5]);
  });
});
