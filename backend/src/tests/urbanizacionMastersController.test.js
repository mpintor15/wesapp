jest.mock('../config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('../config/logger', () => ({ error: jest.fn() }));

const db = require('../config/database');
const controller = require('../controllers/urbanizacionMastersController');

const response = () => {
  const res = {
    statusCode: 200,
    body: null,
    status: jest.fn((status) => {
      res.statusCode = status;
      return res;
    }),
    json: jest.fn((body) => {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const request = (params, body = {}) => ({ params, body, user: { id: 50 } });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('urbanizacion masters controller', () => {
  test('GENERAL rechaza crear Manzana', async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: 1, tipo_punto: 'GENERAL' }],
        rowCount: 1,
      }),
    };
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();

    await controller.createManzana(request({ ubicacionId: '1' }, { nombre: ' A ' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('LOCATION_NOT_URBANIZATION');
  });

  test('URBANIZACION permite crear Manzana normalizando espacios', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 1, tipo_punto: 'URBANIZACION' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 7, ubicacion_id: 1, nombre: 'Etapa A' }],
        rowCount: 1,
      });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();

    await controller.createManzana(request({ ubicacionId: '1' }, { nombre: '  Etapa   A ' }), res);

    expect(res.statusCode).toBe(201);
    expect(client.query.mock.calls[1][1]).toEqual([1, 'Etapa A', 50]);
  });

  test('duplicado normalizado de Manzana devuelve conflicto controlado', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 1, tipo_punto: 'URBANIZACION' }], rowCount: 1 })
      .mockRejectedValueOnce({ code: '23505' });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();

    await controller.createManzana(request({ ubicacionId: '1' }, { nombre: 'A' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_MASTER');
  });

  test('crea Villa válida y rechaza Manzana inactiva', async () => {
    const activeClient = { query: jest.fn() };
    activeClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, ubicacion_id: 1, estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 1, tipo_punto: 'URBANIZACION' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 9, manzana_id: 2, identificador: 'Villa 1' }],
        rowCount: 1,
      });
    db.transaction.mockImplementationOnce((callback) => callback(activeClient));
    const created = response();
    await controller.createVilla(
      request({ manzanaId: '2' }, { identificador: ' Villa   1 ' }),
      created
    );
    expect(created.statusCode).toBe(201);

    const inactiveClient = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: 2, ubicacion_id: 1, estado: 'inactivo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      }),
    };
    db.transaction.mockImplementationOnce((callback) => callback(inactiveClient));
    const rejected = response();
    await controller.createVilla(request({ manzanaId: '2' }, { identificador: '2' }), rejected);
    expect(rejected.statusCode).toBe(409);
    expect(rejected.body.code).toBe('BLOCK_INACTIVE');
  });

  test('duplicado normalizado de Villa devuelve conflicto controlado', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, ubicacion_id: 1, estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 1, tipo_punto: 'URBANIZACION' }], rowCount: 1 })
      .mockRejectedValueOnce({ code: '23505' });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();
    await controller.createVilla(request({ manzanaId: '2' }, { identificador: 'A' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_MASTER');
  });

  test('desactivar Manzana con Villas activas devuelve conflicto', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, ubicacion_id: 1, nombre: 'A', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();
    await controller.updateManzana(request({ manzanaId: '2' }, { estado: 'inactivo' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('BLOCK_HAS_ACTIVE_VILLAS');
  });

  test('reactiva Manzana validando que la ubicación siga siendo URBANIZACION', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, ubicacion_id: 1, nombre: 'A', estado: 'inactivo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 1, tipo_punto: 'URBANIZACION' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 2, estado: 'activo' }], rowCount: 1 });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();
    await controller.updateManzana(request({ manzanaId: '2' }, { estado: 'activo' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.estado).toBe('activo');
  });

  test('desactiva y reactiva Villa validando la cadena al reactivar', async () => {
    const inactiveClient = { query: jest.fn() };
    inactiveClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            manzana_id: 2,
            identificador: '1',
            estado: 'activo',
            manzana_estado: 'activo',
            ubicacion_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 5, estado: 'inactivo' }], rowCount: 1 });
    db.transaction.mockImplementationOnce((callback) => callback(inactiveClient));
    const deactivated = response();
    await controller.updateVilla(request({ villaId: '5' }, { estado: 'inactivo' }), deactivated);
    expect(deactivated.body.data.estado).toBe('inactivo');

    const activeClient = { query: jest.fn() };
    activeClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            manzana_id: 2,
            identificador: '1',
            estado: 'inactivo',
            manzana_estado: 'activo',
            ubicacion_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 1, tipo_punto: 'URBANIZACION' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 5, estado: 'activo' }], rowCount: 1 });
    db.transaction.mockImplementationOnce((callback) => callback(activeClient));
    const reactivated = response();
    await controller.updateVilla(request({ villaId: '5' }, { estado: 'activo' }), reactivated);
    expect(reactivated.body.data.estado).toBe('activo');
  });

  test('consulta Villa sin Residente principal', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'activo', manzana_estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = response();
    await controller.getResidentePrincipal(request({ villaId: '5' }), res);
    expect(res.body).toEqual({ success: true, data: null });
  });

  test('crea Residente principal bloqueando la Villa para evitar concurrencia', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'activo', manzana_estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 8, villa_id: 5, nombre: 'Ana', contacto: '099', activo: true }],
        rowCount: 1,
      });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();
    await controller.createResidentePrincipal(
      request({ villaId: '5' }, { nombre: ' Ana ', contacto: ' 099 ' }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE OF v, m');
  });

  test('reemplaza Residente principal transaccionalmente', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'activo', manzana_estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 9, nombre: 'Luis', activo: true }], rowCount: 1 });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();
    await controller.createResidentePrincipal(
      request({ villaId: '5' }, { nombre: 'Luis', contacto: '098', reemplazar: true }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(client.query.mock.calls[2][0]).toContain('UPDATE residentes SET activo = FALSE');
    expect(client.query.mock.calls[3][0]).toContain('INSERT INTO residentes');
  });

  test('Villa inactiva rechaza crear y reactivar Residente', async () => {
    const createClient = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'inactivo', manzana_estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      }),
    };
    db.transaction.mockImplementationOnce((callback) => callback(createClient));
    const created = response();
    await controller.createResidentePrincipal(
      request({ villaId: '5' }, { nombre: 'Ana', contacto: '099' }),
      created
    );
    expect(created.statusCode).toBe(409);

    const updateClient = { query: jest.fn() };
    updateClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 8, villa_id: 5, nombre: 'Ana', contacto: '099', activo: false }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'inactivo', manzana_estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      });
    db.transaction.mockImplementationOnce((callback) => callback(updateClient));
    const updated = response();
    await controller.updateResidentePrincipal(
      request({ residenteId: '8' }, { activo: true }),
      updated
    );
    expect(updated.statusCode).toBe(409);
  });

  test('edita, desactiva y reactiva Residente principal', async () => {
    const editClient = { query: jest.fn() };
    editClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 8, villa_id: 5, nombre: 'Ana', contacto: '099', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 8, nombre: 'Ana P.', contacto: '098', activo: false }],
        rowCount: 1,
      });
    db.transaction.mockImplementationOnce((callback) => callback(editClient));
    const edited = response();
    await controller.updateResidentePrincipal(
      request({ residenteId: '8' }, { nombre: 'Ana P.', contacto: '098', activo: false }),
      edited
    );
    expect(edited.statusCode).toBe(200);

    const reactivateClient = { query: jest.fn() };
    reactivateClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 8, villa_id: 5, nombre: 'Ana P.', contacto: '098', activo: false }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'activo', manzana_estado: 'activo', tipo_punto: 'URBANIZACION' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 8, activo: true }], rowCount: 1 });
    db.transaction.mockImplementationOnce((callback) => callback(reactivateClient));
    const reactivated = response();
    await controller.updateResidentePrincipal(
      request({ residenteId: '8' }, { activo: true }),
      reactivated
    );
    expect(reactivated.body.data.activo).toBe(true);
  });

  test('desactivar Villa con Residente principal activo devuelve conflicto', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, estado: 'activo', manzana_estado: 'activo', ubicacion_id: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    db.transaction.mockImplementation((callback) => callback(client));
    const res = response();
    await controller.updateVilla(request({ villaId: '5' }, { estado: 'inactivo' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('VILLA_HAS_ACTIVE_RESIDENT');
  });
});
