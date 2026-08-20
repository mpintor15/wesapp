jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAuditStrict: jest.fn(),
  auditFromReq: jest.fn(() => ({ usuario_id: 7, usuario_nombre: 'guardia' })),
}));

jest.mock('../repositories/bitacorasRepository', () => ({
  findHistory: jest.fn(),
  findLockedUserLocationAssignment: jest.fn(),
  findVisibleLocations: jest.fn(),
}));

const db = require('../config/database');
const audit = require('../utils/audit');
const repository = require('../repositories/bitacorasRepository');
const controller = require('../controllers/bitacorasController');

const makeResponse = () => {
  const res = { status: jest.fn(), json: jest.fn(), headersSent: false };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const makeRequest = (overrides = {}) => ({
  user: {
    id: 7,
    usuario: 'guardia',
    tipo_usuario: 'guardia',
    activo: true,
  },
  body: {
    ubicacion_id: 3,
    ocurrido_at: '2026-08-20T14:30:00',
    detalle: 'Novedad registrada',
  },
  query: {},
  ip: '127.0.0.1',
  get: jest.fn(() => 'jest'),
  ...overrides,
});

const createdRow = {
  id: 11,
  ubicacion_id: 3,
  autor_usuario_id: 7,
  autor_colaborador_id: 21,
  ocurrido_at: new Date('2026-08-20T19:30:00.000Z'),
  detalle: 'Novedad registrada',
  estado: 'REGISTRADA',
  created_at: new Date('2026-08-20T19:31:00.000Z'),
};

const transactionForCreate = ({
  assigned = true,
  locationExists = true,
  persistedRole = 'guardia',
} = {}) => {
  const client = { query: jest.fn() };
  client.query.mockImplementation(async (sql) => {
    const query = String(sql);
    if (query.includes('FROM usuarios')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 7,
            usuario: 'guardia',
            tipo_usuario: persistedRole,
            colaborador_id: 21,
            activo: true,
          },
        ],
      };
    }
    if (query.includes('FROM colaboradores')) {
      return { rowCount: 1, rows: [{ id: 21 }] };
    }
    if (query.includes('FROM ubicaciones')) {
      return locationExists
        ? { rowCount: 1, rows: [{ id: 3, nombre: 'Punto', tipo_punto: 'GENERAL' }] }
        : { rowCount: 0, rows: [] };
    }
    if (query.includes('INSERT INTO bitacora_registros')) {
      return { rowCount: 1, rows: [createdRow] };
    }
    throw new Error(`Unexpected query: ${query}`);
  });
  repository.findLockedUserLocationAssignment.mockResolvedValue(
    assigned ? { usuario_id: 7, ubicacion_id: 3 } : null
  );
  db.transaction.mockImplementation(async (callback) => callback(client));
  return client;
};

beforeEach(() => {
  jest.clearAllMocks();
  audit.logAuditStrict.mockResolvedValue(undefined);
});

describe('bitacorasController.createRegistro', () => {
  test('crea con Ubicación asignada, autor derivado y auditoría estricta', async () => {
    const client = transactionForCreate();
    const req = makeRequest();
    const res = makeResponse();

    await controller.createRegistro(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: createdRow })
    );
    const insertCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO bitacora_registros')
    );
    expect(insertCall[1]).toEqual([3, 7, 21, '2026-08-20T14:30:00', 'Novedad registrada']);
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: 11,
        datos_nuevos: createdRow,
      })
    );
  });

  test('crea con alcance global sin consultar asignación', async () => {
    transactionForCreate({ assigned: false, persistedRole: 'supervisor' });
    const req = makeRequest({
      user: { id: 7, usuario: 'supervisor', tipo_usuario: 'supervisor', activo: true },
    });
    const res = makeResponse();

    await controller.createRegistro(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(repository.findLockedUserLocationAssignment).not.toHaveBeenCalled();
  });

  test('usa el rol persistido actual y no el snapshot global del request', async () => {
    transactionForCreate({ assigned: false, persistedRole: 'guardia' });
    const req = makeRequest({
      user: { id: 7, usuario: 'supervisor', tipo_usuario: 'supervisor', activo: true },
    });
    const res = makeResponse();

    await controller.createRegistro(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('reconoce alcance global adquirido en DB aunque el request conserve rol no global', async () => {
    transactionForCreate({ assigned: false, persistedRole: 'supervisor' });
    const res = makeResponse();

    await controller.createRegistro(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(repository.findLockedUserLocationAssignment).not.toHaveBeenCalled();
  });

  test('usa el helper productivo de asignación antes de insertar', async () => {
    const client = transactionForCreate();
    const res = makeResponse();

    await controller.createRegistro(makeRequest(), res);

    expect(repository.findLockedUserLocationAssignment).toHaveBeenCalledWith({
      client,
      userId: 7,
      locationId: 3,
    });
  });

  test('rechaza fuera de asignación', async () => {
    transactionForCreate({ assigned: false });
    const res = makeResponse();

    await controller.createRegistro(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No tienes acceso a la Ubicación seleccionada' })
    );
    expect(audit.logAuditStrict).not.toHaveBeenCalled();
  });

  test('responde 404 para Ubicación inexistente', async () => {
    transactionForCreate({ locationExists: false });
    const res = makeResponse();
    await controller.createRegistro(makeRequest(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rechaza Usuario sin Colaborador', async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 7,
            usuario: 'legacy',
            tipo_usuario: 'guardia',
            colaborador_id: null,
            activo: true,
          },
        ],
      }),
    };
    db.transaction.mockImplementation(async (callback) => callback(client));
    const res = makeResponse();

    await controller.createRegistro(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'El Usuario autenticado no tiene un Colaborador asociado',
      })
    );
  });

  test.each([
    [
      'fallo de inserción',
      (client) => client.query.mockRejectedValueOnce(new Error('insert down')),
    ],
    [
      'fallo de auditoría',
      () => audit.logAuditStrict.mockRejectedValueOnce(new Error('audit down')),
    ],
  ])('sanitiza y propaga rollback transaccional ante %s', async (_label, prepareFailure) => {
    const client = transactionForCreate();
    if (_label === 'fallo de inserción') {
      const original = client.query.getMockImplementation();
      client.query.mockImplementation(async (sql, params) => {
        if (String(sql).includes('INSERT INTO bitacora_registros')) {
          throw new Error('insert down');
        }
        return original(sql, params);
      });
    } else {
      prepareFailure(client);
    }
    db.transaction.mockImplementation(async (callback) => {
      try {
        return await callback(client);
      } catch (error) {
        error.transactionRolledBack = true;
        throw error;
      }
    });
    const res = makeResponse();

    await controller.createRegistro(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Error en el servidor' });
  });
});

describe('bitacorasController.getRegistros', () => {
  beforeEach(() => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'guardia', activo: true }],
    });
  });

  test('consulta historial global con filtros, paginación y metadata', async () => {
    repository.findHistory.mockResolvedValue({ items: [createdRow], total: 26 });
    const req = makeRequest({
      user: { id: 8, usuario: 'supervisor', tipo_usuario: 'supervisor', activo: true },
      query: {
        page: '2',
        pageSize: '10',
        ubicacion_id: '3',
        fecha_desde: '2026-08-01',
        fecha_hasta: '2026-08-20',
        estado: 'REGISTRADA',
      },
    });
    const res = makeResponse();

    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 8, tipo_usuario: 'supervisor', activo: true }],
    });

    await controller.getRegistros(req, res);

    expect(repository.findHistory).toHaveBeenCalledWith({
      filters: {
        ubicacionId: 3,
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-20',
        estado: 'REGISTRADA',
      },
      hasGlobalScope: true,
      userId: 8,
      pagination: expect.objectContaining({ page: 2, pageSize: 10, offset: 10 }),
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [createdRow],
      meta: expect.objectContaining({ page: 2, pageSize: 10, totalItems: 26, totalPages: 3 }),
    });
  });

  test('aplica alcance asignado y no fuga historial global', async () => {
    repository.findHistory.mockResolvedValue({ items: [], total: 0 });
    const res = makeResponse();
    await controller.getRegistros(makeRequest(), res);
    expect(repository.findHistory).toHaveBeenCalledWith(
      expect.objectContaining({ hasGlobalScope: false, userId: 7 })
    );
  });

  test('consulta historial con alcance del Usuario persistido, no del request', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'supervisor', activo: true }],
    });
    repository.findHistory.mockResolvedValue({ items: [], total: 0 });

    await controller.getRegistros(makeRequest(), makeResponse());

    expect(repository.findHistory).toHaveBeenCalledWith(
      expect.objectContaining({ hasGlobalScope: true, userId: 7 })
    );
  });

  test('rechaza filtro de Ubicación fuera del alcance', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 7, tipo_usuario: 'guardia', activo: true }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeResponse();
    await controller.getRegistros(makeRequest({ query: { ubicacion_id: '99' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(repository.findHistory).not.toHaveBeenCalled();
  });

  test.each([
    [{ page: '0' }, 'page debe ser mayor o igual a 1'],
    [{ pageSize: '101' }, 'pageSize debe estar entre 10 y 100'],
    [{ fecha_desde: '2026-02-30' }, 'fecha_desde debe tener formato'],
    [{ fecha_desde: '2026-08-20', fecha_hasta: '2026-08-01' }, 'rango de fechas'],
    [{ estado: 'BORRADA' }, 'estado debe ser REGISTRADA o ANULADA'],
    [{ search: 'secreto' }, 'Filtro no permitido'],
  ])('rechaza query inválida %#', async (query, message) => {
    const res = makeResponse();
    await controller.getRegistros(makeRequest({ query }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(new RegExp(message, 'i'));
  });

  test('sanitiza error de DB', async () => {
    repository.findHistory.mockRejectedValue(new Error('select secret'));
    const res = makeResponse();
    await controller.getRegistros(makeRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Error en el servidor' });
  });
});

describe('bitacorasController.getUbicacionesVisibles', () => {
  beforeEach(() => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'guardia', activo: true }],
    });
  });

  test('devuelve solo datos del repositorio con el alcance calculado', async () => {
    const locations = [{ id: 3, nombre: 'Punto', tipo_punto: 'GENERAL' }];
    repository.findVisibleLocations.mockResolvedValue(locations);
    const res = makeResponse();
    await controller.getUbicacionesVisibles(makeRequest(), res);
    expect(repository.findVisibleLocations).toHaveBeenCalledWith({
      hasGlobalScope: false,
      userId: 7,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: locations });
  });

  test('calcula alcance desde el Usuario persistido actual', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'supervisor', activo: true }],
    });
    repository.findVisibleLocations.mockResolvedValue([]);

    await controller.getUbicacionesVisibles(makeRequest(), makeResponse());

    expect(repository.findVisibleLocations).toHaveBeenCalledWith({
      hasGlobalScope: true,
      userId: 7,
    });
  });
});
