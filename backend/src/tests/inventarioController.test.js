jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../config/logger', () => ({
  error: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, ip: '127.0.0.1' })),
}));

const db = require('../config/database');
const { logAudit } = require('../utils/audit');
const {
  createArticulo,
  darBajaArticulo,
  createMovimiento,
} = require('../controllers/inventarioController');

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

const makeClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
});

const expectStatus = (res, status) => {
  expect(res.status).toHaveBeenCalledWith(status);
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('inventarioController.createArticulo', () => {
  test('crea artículo de stock válido', async () => {
    const articulo = {
      id: 10,
      tipo_articulo: 'equipo',
      nombre_articulo: 'Chaleco',
      cantidad: 3,
      ubicacion_id: 2,
    };
    db.query.mockResolvedValue({ rows: [articulo], rowCount: 1 });
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco',
          cantidad: 3,
          ubicacion_id: 2,
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data).toMatchObject(articulo);
    expect(logAudit).toHaveBeenCalledWith(db, expect.objectContaining({ tabla: 'articulos' }));
  });

  test('rechaza cantidad inválida en artículos de stock', async () => {
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco',
          cantidad: 0,
          ubicacion_id: 2,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/cantidad/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rechaza artículo sin ubicación', async () => {
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco',
          cantidad: 1,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/ubicación/i);
  });

  test('reporta duplicados de número de serie como error de validación', async () => {
    db.query.mockRejectedValue({ code: '23505', constraint: 'articulos_numero_serie_key' });
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'arma',
          nombre_articulo: 'Pistola',
          numero_serie: 'ABC-1',
          ubicacion_id: 2,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/Ya existe/);
  });
});

describe('inventarioController.darBajaArticulo', () => {
  test('hace rollback si la baja supera el stock disponible', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 2, nombre_articulo: 'Chaleco' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await darBajaArticulo(
      mockReq({ params: { id: '10' }, body: { motivo: 'Dañado', cantidad: 3 } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/stock disponible/);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('registra baja parcial y confirma transacción', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 5,
            ubicacion_id: 2,
            ubicacion_nombre: 'Bodega',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const res = mockRes();

    await darBajaArticulo(
      mockReq({ params: { id: '10' }, body: { motivo: 'Dañado', cantidad: 2 } }),
      res
    );

    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE articulos SET cantidad = $1 WHERE id = $2',
      [3, 10]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(logAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'articulos_bajas' })
    );
  });
});

describe('inventarioController.createMovimiento', () => {
  test('rechaza movimiento sin items antes de iniciar transacción', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    const res = mockRes();

    await createMovimiento(
      mockReq({ body: { ubicacion_destino_id: 2, items: [] }, user: { id: 1 } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/artículo/i);
    expect(client.query).not.toHaveBeenCalledWith('BEGIN');
    expect(client.release).toHaveBeenCalled();
  });

  test('hace rollback si destino coincide con origen', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 5, ubicacion_id: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 2, items: [{ articulo_id: 10, cantidad: 1 }] },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/destino no puede ser igual/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('hace rollback si la cantidad supera el stock', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 1, ubicacion_id: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 2, items: [{ articulo_id: 10, cantidad: 2 }] },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/stock disponible/);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
