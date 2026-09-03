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
  getColaboradores,
  createColaborador,
  updateColaborador,
  deleteColaborador,
} = require('../controllers/personalController');

const mockReq = ({ body = {}, params = {}, query = {}, user = { id: 1 } } = {}) => ({
  body,
  params,
  query,
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

describe('personalController.getColaboradores', () => {
  test('filtro estado inválido responde 400 y no ejecuta query', async () => {
    const res = mockRes();

    await getColaboradores(mockReq({ query: { estado: 'suspendido' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/estado/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('pagina server-side, retorna metadata estándar y no filtra total_count en cada fila', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 1, nombres_completos: 'Ana Torres', total_count: 2 },
        { id: 2, nombres_completos: 'Beto Ruiz', total_count: 2 },
      ],
      rowCount: 2,
    });
    const res = mockRes();

    await getColaboradores(mockReq({ query: { page: '2', pageSize: '10' } }), res);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('COUNT(*) OVER()::int AS total_count');
    expect(sql).toContain('LIMIT $1 OFFSET $2');
    expect(params).toEqual([10, 10]);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        { id: 1, nombres_completos: 'Ana Torres', acceso: { tiene_usuario: false } },
        { id: 2, nombres_completos: 'Beto Ruiz', acceso: { tiene_usuario: false } },
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
  });

  test('lista vacía retorna totalItems 0 sin romper metadata', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = mockRes();

    await getColaboradores(mockReq({ query: {} }), res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });
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

  test('rechaza fecha imposible sin ejecutar query', async () => {
    const res = mockRes();

    await createColaborador(
      mockReq({
        body: {
          nombres_completos: 'Ana Torres',
          cedula: '0102030405',
          fecha_nacimiento: '2026-02-30',
          cargo: 'Analista',
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/fecha/i);
    expect(db.query).not.toHaveBeenCalled();
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

  test('rechaza id alfanumérico sin ejecutar query', async () => {
    const res = mockRes();

    await updateColaborador(mockReq({ params: { id: '12abc' }, body: { estado: 'activo' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rechaza fecha imposible en actualización', async () => {
    const res = mockRes();

    await updateColaborador(
      mockReq({ params: { id: '3' }, body: { fecha_nacimiento: '2026-13-01' } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/fecha/i);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('personalController.deleteColaborador', () => {
  test('rechaza eliminar un colaborador vinculado a un usuario', async () => {
    db.query.mockRejectedValue({
      code: '23503',
      constraint: 'usuarios_colaborador_id_fkey',
    });
    const res = mockRes();

    await deleteColaborador(mockReq({ params: { id: '7' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/vinculado a un usuario/i) })
    );
  });

  test('rechaza eliminar un colaborador con autoría histórica de Bitácora', async () => {
    db.query.mockRejectedValue({
      code: '23503',
      constraint: 'bitacora_registros_autor_colaborador_id_fkey',
      detail: 'Key (id)=(7) is still referenced from table bitacora_registros.',
    });
    const res = mockRes();

    await deleteColaborador(mockReq({ params: { id: '7' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'El colaborador tiene registros históricos de Bitácora y no puede eliminarse',
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(
      /bitacora_registros_autor_colaborador_id_fkey|Key \(id\)/
    );
  });

  test('retorna 404 si el colaborador no existe', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = mockRes();

    await deleteColaborador(mockReq({ params: { id: '99' } }), res);

    const body = expectStatus(res, 404);
    expect(body.message).toMatch(/no encontrado/i);
  });

  test('rechaza id decimal sin ejecutar query', async () => {
    const res = mockRes();

    await deleteColaborador(mockReq({ params: { id: '1.5' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id/i);
    expect(db.query).not.toHaveBeenCalled();
  });
});
