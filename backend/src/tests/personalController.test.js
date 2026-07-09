jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, ip: '127.0.0.1' })),
}));

const db = require('../config/database');
const { logAudit } = require('../utils/audit');
const {
  createColaborador,
  updateColaborador,
  deleteColaborador,
} = require('../controllers/personalController');

const mockReq = ({ body = {}, params = {}, user = { id: 1 } } = {}) => ({
  body,
  params,
  user,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const expectStatus = (res, status) => {
  expect(res.status).toHaveBeenCalledWith(status);
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('personalController.createColaborador', () => {
  test('crea colaborador válido', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 3, nombres_completos: 'Ana Torres', cedula: '0102030405', estado: 'activo' }],
      rowCount: 1,
    });
    const res = mockRes();

    await createColaborador(
      mockReq({
        body: {
          nombres_completos: 'Ana Torres',
          cedula: '0102030405',
          fecha_nacimiento: '1990-01-01',
          cargo: 'Analista',
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(logAudit).toHaveBeenCalledWith(db, expect.objectContaining({ tabla: 'colaboradores' }));
  });

  test('rechaza campos obligatorios faltantes', async () => {
    const res = mockRes();

    await createColaborador(mockReq({ body: { nombres_completos: 'Ana Torres' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/Campos requeridos/);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('reporta cédula duplicada', async () => {
    db.query.mockRejectedValue({ code: '23505' });
    const res = mockRes();

    await createColaborador(
      mockReq({
        body: {
          nombres_completos: 'Ana Torres',
          cedula: '0102030405',
          fecha_nacimiento: '1990-01-01',
          cargo: 'Analista',
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/cédula/i);
  });
});

describe('personalController.updateColaborador', () => {
  test('actualiza colaborador válido', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 3, nombres_completos: 'Ana Torres', estado: 'inactivo' }],
      rowCount: 1,
    });
    const res = mockRes();

    await updateColaborador(
      mockReq({ params: { id: '3' }, body: { estado: 'inactivo', sueldo: '750.50' } }),
      res
    );

    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ success: true }));
    expect(logAudit).toHaveBeenCalledWith(db, expect.objectContaining({ operacion: 'UPDATE' }));
  });

  test('rechaza update sin campos', async () => {
    const res = mockRes();

    await updateColaborador(mockReq({ params: { id: '3' }, body: {} }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/No hay campos/);
  });
});

describe('personalController.deleteColaborador', () => {
  test('retorna 404 si el colaborador no existe', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = mockRes();

    await deleteColaborador(mockReq({ params: { id: '99' } }), res);

    const body = expectStatus(res, 404);
    expect(body.message).toMatch(/no encontrado/i);
  });
});
