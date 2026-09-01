jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAuditStrict: jest.fn(),
  auditFromReq: jest.fn(() => ({ usuario_id: 7, usuario_nombre: 'guardia' })),
}));

jest.mock('../repositories/bitacorasRepository', () => ({
  findActiveBlocksForLocation: jest.fn(),
  findActivePrincipalResidentForVilla: jest.fn(),
  findActiveVisitFormForLocation: jest.fn(),
  findVisitForms: jest.fn(),
  findVisitFormCreators: jest.fn(),
  findActiveVillasForBlock: jest.fn(),
  findHistory: jest.fn(),
  findLockedVisit: jest.fn(),
  findLockedBlock: jest.fn(),
  findLockedUserLocationAssignment: jest.fn(),
  findLockedVilla: jest.fn(),
  findVisits: jest.fn(),
  findVisitCreators: jest.fn(),
  findVisibleBlock: jest.fn(),
  findVisibleLocation: jest.fn(),
  findVisibleLocations: jest.fn(),
  insertBitacoraRegistro: jest.fn(),
  insertVisitResponses: jest.fn(),
  publishVisitFormForLocation: jest.fn(),
  acquireVisitFormPublishLock: jest.fn(),
  findLockedVisitFormVersion: jest.fn(),
  archiveVisitFormVersion: jest.fn(),
  createVisit: jest.fn(),
  closeVisit: jest.fn(),
  cancelVisit: jest.fn(),
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
  created = createdRow,
  locationExists = true,
  locationType = 'GENERAL',
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
        ? { rowCount: 1, rows: [{ id: 3, nombre: 'Punto', tipo_punto: locationType }] }
        : { rowCount: 0, rows: [] };
    }
    if (query.includes('INSERT INTO bitacora_registros')) {
      return { rowCount: 1, rows: [created] };
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
  repository.findLockedBlock.mockResolvedValue({
    id: 8,
    ubicacion_id: 3,
    nombre: 'A',
    estado: 'activo',
  });
  repository.findLockedVilla.mockResolvedValue({
    id: 9,
    manzana_id: 8,
    identificador: 'V1',
    estado: 'activo',
  });
  repository.findActivePrincipalResidentForVilla.mockResolvedValue({
    id: 15,
    villa_id: 9,
    nombre: 'Ana Titular',
    contacto: '0991234567',
  });
  repository.findVisitFormCreators.mockResolvedValue([{ id: 7, usuario: 'guardia' }]);
  repository.findActiveVisitFormForLocation.mockResolvedValue({
    id: 51,
    ubicacion_id: 3,
    version: 1,
    titulo: 'Formulario',
    tipos: [
      { id: 900, form_version_id: 51, nombre: 'Peatón', sort_order: 1 },
      { id: 901, form_version_id: 51, nombre: 'Vehículo', sort_order: 2 },
    ],
    fields: [
      {
        id: 91,
        field_key: 'motivo',
        label: 'Motivo',
        type: 'select',
        required: true,
        options: ['Entrega', 'Visita'],
      },
      {
        id: 92,
        field_key: 'autorizado',
        label: 'Autorizado',
        type: 'checkbox',
        required: false,
        options: [],
      },
    ],
  });
  repository.insertBitacoraRegistro.mockResolvedValue({
    id: 71,
    ubicacion_id: 3,
    manzana_id: 8,
    villa_id: 9,
    detalle: 'Ingreso visita',
  });
  repository.createVisit.mockResolvedValue({
    id: 81,
    ubicacion_id: 3,
    manzana_id: 8,
    villa_id: 9,
    estado: 'ABIERTA',
    visitante_nombre: 'Carlos Ruiz',
    placa: 'ABC123',
  });
  repository.closeVisit.mockResolvedValue({ id: 81, estado: 'CERRADA' });
  repository.cancelVisit.mockResolvedValue({
    id: 81,
    estado: 'ANULADA',
    motivo_anulacion: 'Visitante no llegó',
  });
  repository.findLockedVisit.mockResolvedValue({
    id: 81,
    ubicacion_id: 3,
    manzana_id: 8,
    manzana_nombre: 'A',
    villa_id: 9,
    villa_identificador: '1',
    estado: 'ABIERTA',
    visitante_nombre: 'Carlos Ruiz',
    tipo_visita_id: 901,
    tipo_visita_nombre: 'Vehículo',
    placa: 'ABC123',
  });
  repository.findVisits.mockResolvedValue({ items: [], total: 0 });
  repository.findVisitCreators.mockResolvedValue([{ id: 21, nombre: 'Guardia Uno' }]);
  repository.publishVisitFormForLocation.mockResolvedValue({
    id: 51,
    ubicacion_id: 3,
    version: 2,
    titulo: 'Formulario',
    fields: [],
  });
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
    expect(insertCall[1]).toEqual([
      3,
      null,
      null,
      7,
      21,
      '2026-08-20T14:30:00',
      'Novedad registrada',
    ]);
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

  test('valida y persiste Manzana y Villa activas de la cadena seleccionada', async () => {
    const urbanCreated = { ...createdRow, manzana_id: 8, villa_id: 9 };
    const client = transactionForCreate({
      created: urbanCreated,
      locationType: 'URBANIZACION',
    });
    const req = makeRequest({
      body: { ...makeRequest().body, manzana_id: 8, villa_id: 9 },
    });

    await controller.createRegistro(req, makeResponse());

    expect(repository.findLockedBlock).toHaveBeenCalledWith({ client, blockId: 8 });
    expect(repository.findLockedVilla).toHaveBeenCalledWith({ client, villaId: 9 });
    expect(repository.findActivePrincipalResidentForVilla).toHaveBeenCalledWith({
      client,
      villaId: 9,
    });
    const insertCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO bitacora_registros')
    );
    expect(insertCall[1]).toEqual([3, 8, 9, 7, 21, '2026-08-20T14:30:00', 'Novedad registrada']);
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ datos_nuevos: urbanCreated })
    );
  });

  test.each([
    ['GENERAL con contexto', {}, 409, 'URBAN_CONTEXT_NOT_ALLOWED'],
    ['Manzana inexistente', { block: null }, 404, 'BLOCK_NOT_FOUND'],
    ['Manzana inactiva', { block: { estado: 'inactivo' } }, 409, 'BLOCK_INACTIVE'],
    ['Manzana de otra Ubicación', { block: { ubicacion_id: 99 } }, 409, 'INVALID_URBAN_CHAIN'],
    ['Villa inexistente', { villa: null }, 404, 'VILLA_NOT_FOUND'],
    ['Villa inactiva', { villa: { estado: 'inactivo' } }, 409, 'VILLA_INACTIVE'],
    ['Villa de otra Manzana', { villa: { manzana_id: 99 } }, 409, 'INVALID_URBAN_CHAIN'],
    ['Villa sin titular activo', { resident: null }, 409, 'VILLA_WITHOUT_ACTIVE_RESIDENT'],
  ])('rechaza %s con semántica pública estable', async (_label, overrides, status, code) => {
    const locationType = _label === 'GENERAL con contexto' ? 'GENERAL' : 'URBANIZACION';
    transactionForCreate({ locationType });
    if (Object.hasOwn(overrides, 'block')) {
      repository.findLockedBlock.mockResolvedValue(
        overrides.block && {
          id: 8,
          ubicacion_id: 3,
          nombre: 'A',
          estado: 'activo',
          ...overrides.block,
        }
      );
    }
    if (Object.hasOwn(overrides, 'villa')) {
      repository.findLockedVilla.mockResolvedValue(
        overrides.villa && {
          id: 9,
          manzana_id: 8,
          identificador: 'V1',
          estado: 'activo',
          ...overrides.villa,
        }
      );
    }
    if (Object.hasOwn(overrides, 'resident')) {
      repository.findActivePrincipalResidentForVilla.mockResolvedValue(overrides.resident);
    }
    const res = makeResponse();

    await controller.createRegistro(
      makeRequest({ body: { ...makeRequest().body, manzana_id: 8, villa_id: 9 } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code }));
  });

  test.each([
    ['sin Manzana ni Villa', {}],
    ['solo con Manzana', { manzana_id: 8 }],
    ['solo con Villa', { villa_id: 9 }],
  ])(
    'rechaza URBANIZACION %s porque Casa completa es obligatoria',
    async (_label, urbanContext) => {
      transactionForCreate({ locationType: 'URBANIZACION' });
      const res = makeResponse();

      await controller.createRegistro(
        makeRequest({ body: { ...makeRequest().body, ...urbanContext } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'COMPLETE_HOUSE_REQUIRED',
        })
      );
    }
  );

  test('convierte una defensa FK de D1 en 409 sin filtrar detalles SQL', async () => {
    const client = transactionForCreate({ locationType: 'URBANIZACION' });
    const original = client.query.getMockImplementation();
    client.query.mockImplementation(async (sql, params) => {
      if (String(sql).includes('INSERT INTO bitacora_registros')) {
        const error = new Error('constraint interna secreta');
        error.code = '23503';
        error.constraint = 'bitacora_registros_manzana_ubicacion_fkey';
        throw error;
      }
      return original(sql, params);
    });
    const res = makeResponse();
    await controller.createRegistro(
      makeRequest({ body: { ...makeRequest().body, manzana_id: 8, villa_id: 9 } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'INVALID_URBAN_CHAIN',
      message: 'El contexto urbano dejó de ser válido',
    });
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
        autor: '  Ana  ',
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
        autor: 'Ana',
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

  test('omite autor compuesto únicamente por whitespace', async () => {
    repository.findHistory.mockResolvedValue({ items: [], total: 0 });

    await controller.getRegistros(makeRequest({ query: { autor: '   ' } }), makeResponse());

    expect(repository.findHistory).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ autor: undefined }) })
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
    [{ autor: 'a'.repeat(101) }, 'autor no puede exceder'],
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

describe('bitacorasController opciones urbanas', () => {
  const scopeClient = (location = { id: 3, tipo_punto: 'URBANIZACION' }) => ({
    query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [location] }),
  });

  beforeEach(() => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'guardia', activo: true }],
    });
    repository.findLockedUserLocationAssignment.mockResolvedValue({
      usuario_id: 7,
      ubicacion_id: 3,
    });
    repository.findActiveBlocksForLocation.mockResolvedValue([{ id: 8, nombre: 'A' }]);
    repository.findActiveVillasForBlock.mockResolvedValue([{ id: 9, identificador: 'A-1' }]);
    repository.findVisibleBlock.mockResolvedValue({ id: 8, ubicacion_id: 3, estado: 'activo' });
    repository.findVisibleLocation.mockResolvedValue({
      id: 3,
      tipo_punto: 'URBANIZACION',
    });
    repository.findLockedBlock.mockResolvedValue({ id: 8, ubicacion_id: 3, estado: 'activo' });
  });

  test('lista Manzanas activas dentro del alcance y GENERAL devuelve vacío', async () => {
    let client = scopeClient();
    db.transaction.mockImplementation(async (callback) => callback(client));
    const urbanResponse = makeResponse();
    await controller.getManzanasElegibles(
      makeRequest({ params: { ubicacionId: '3' } }),
      urbanResponse
    );
    expect(repository.findActiveBlocksForLocation).toHaveBeenCalledWith({
      locationId: 3,
      executor: client,
    });

    client = scopeClient({ id: 3, tipo_punto: 'GENERAL' });
    const generalResponse = makeResponse();
    await controller.getManzanasElegibles(
      makeRequest({ params: { ubicacionId: '3' } }),
      generalResponse
    );
    expect(generalResponse.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  test('lista Villas activas solo después de validar alcance y Manzana activa', async () => {
    const client = scopeClient();
    db.transaction.mockImplementation(async (callback) => callback(client));
    const res = makeResponse();
    await controller.getVillasElegibles(makeRequest({ params: { manzanaId: '8' } }), res);
    expect(repository.findActiveVillasForBlock).toHaveBeenCalledWith({
      blockId: 8,
      executor: client,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 9, identificador: 'A-1' }],
    });
  });

  test('opciones de Manzanas colapsan inexistente y fuera de alcance a la misma respuesta', async () => {
    const client = scopeClient();
    db.transaction.mockImplementation(async (callback) => callback(client));
    repository.findVisibleLocation.mockResolvedValue(null);
    const missing = makeResponse();
    await controller.getManzanasElegibles(makeRequest({ params: { ubicacionId: '999' } }), missing);
    const outsideScope = makeResponse();
    await controller.getManzanasElegibles(
      makeRequest({ params: { ubicacionId: '3' } }),
      outsideScope
    );
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(outsideScope.status).toHaveBeenCalledWith(404);
    expect(missing.json.mock.calls[0][0]).toEqual(outsideScope.json.mock.calls[0][0]);
    expect(repository.findActiveBlocksForLocation).not.toHaveBeenCalled();
  });

  test('opciones de Villas colapsan Manzana inexistente y fuera de alcance', async () => {
    repository.findVisibleBlock.mockResolvedValue(null);
    const missing = makeResponse();
    await controller.getVillasElegibles(makeRequest({ params: { manzanaId: '999' } }), missing);
    const outsideScope = makeResponse();
    await controller.getVillasElegibles(makeRequest({ params: { manzanaId: '8' } }), outsideScope);
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(outsideScope.status).toHaveBeenCalledWith(404);
    expect(missing.json.mock.calls[0][0]).toEqual(outsideScope.json.mock.calls[0][0]);
    expect(repository.findActiveVillasForBlock).not.toHaveBeenCalled();
  });

  test('alcance global puede resolver una Manzana de otra Urbanización', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'supervisor', activo: true }],
    });
    repository.findVisibleBlock.mockResolvedValue({ id: 18, ubicacion_id: 4, estado: 'activo' });
    repository.findLockedBlock.mockResolvedValue({ id: 18, ubicacion_id: 4, estado: 'activo' });
    const client = scopeClient({ id: 4, tipo_punto: 'URBANIZACION' });
    db.transaction.mockImplementation(async (callback) => callback(client));
    const res = makeResponse();
    await controller.getVillasElegibles(makeRequest({ params: { manzanaId: '18' } }), res);
    expect(repository.findVisibleBlock).toHaveBeenCalledWith({
      blockId: 18,
      hasGlobalScope: true,
      userId: 7,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 9, identificador: 'A-1' }],
    });
  });
});

describe('bitacorasController visitas urbanas', () => {
  test('lista versiones de formularios con el alcance del Usuario', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'monitorista', activo: true }],
    });
    repository.findVisitForms.mockResolvedValue({
      items: [{ id: 5, version: 2, estado: 'ACTIVE' }],
      total: 1,
    });
    const res = makeResponse();

    await controller.getVisitForms(makeRequest(), res);

    expect(repository.findVisitForms).toHaveBeenCalledWith({
      hasGlobalScope: true,
      userId: 7,
      filters: { nombre: undefined, creator: undefined, locationId: undefined, estado: undefined },
      pagination: expect.objectContaining({ page: 1, pageSize: 25, offset: 0 }),
    });
    expect(repository.findVisitFormCreators).toHaveBeenCalledWith({
      hasGlobalScope: true,
      userId: 7,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 5, version: 2, estado: 'ACTIVE' }],
      meta: expect.objectContaining({ page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }),
      filters: { creators: [{ id: 7, usuario: 'guardia' }] },
    });
  });

  test('publica una nueva versión inmutable con permiso y alcance existentes', async () => {
    const client = transactionForCreate({
      locationType: 'URBANIZACION',
      persistedRole: 'supervisor',
    });
    const res = makeResponse();

    await controller.publishVisitForm(
      makeRequest({
        params: { ubicacionId: '3' },
        body: {
          titulo: 'Ingreso principal',
          mostrar_fecha_hora: false,
          fields: [{ field_key: 'motivo', label: 'Motivo', type: 'text', required: true }],
        },
      }),
      res
    );

    expect(repository.acquireVisitFormPublishLock).toHaveBeenCalledWith({
      client,
      locationId: 3,
    });
    expect(repository.publishVisitFormForLocation).toHaveBeenCalledWith({
      client,
      locationId: 3,
      title: 'Ingreso principal',
      showDateTime: false,
      fields: [{ field_key: 'motivo', label: 'Motivo', type: 'text', required: true }],
      userId: 7,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'bitacora_visit_form_versions', operacion: 'INSERT' })
    );
  });

  test('bloquea a Monitorista reemplazar (editar) un formulario ya publicado', async () => {
    transactionForCreate({ locationType: 'URBANIZACION', persistedRole: 'monitorista' });
    repository.findActiveVisitFormForLocation.mockResolvedValue({
      id: 51,
      ubicacion_id: 3,
      version: 1,
      fields: [],
    });
    const res = makeResponse();

    await controller.publishVisitForm(
      makeRequest({
        params: { ubicacionId: '3' },
        body: { titulo: 'Nuevo', mostrar_fecha_hora: true, fields: [] },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(repository.publishVisitFormForLocation).not.toHaveBeenCalled();
  });

  test('permite a Monitorista publicar el primer formulario cuando la Ubicación no tiene versión activa', async () => {
    transactionForCreate({ locationType: 'URBANIZACION', persistedRole: 'monitorista' });
    repository.findActiveVisitFormForLocation.mockResolvedValue(null);
    const res = makeResponse();

    await controller.publishVisitForm(
      makeRequest({
        params: { ubicacionId: '3' },
        body: { titulo: 'Nuevo', mostrar_fecha_hora: true, fields: [] },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(repository.publishVisitFormForLocation).toHaveBeenCalled();
  });

  test('Gerente puede archivar un formulario activo y registra auditoría', async () => {
    const client = transactionForCreate({ locationType: 'URBANIZACION', persistedRole: 'gerente' });
    repository.findLockedVisitFormVersion.mockResolvedValue({
      id: 9,
      ubicacion_id: 3,
      version: 2,
      estado: 'ACTIVE',
    });
    repository.archiveVisitFormVersion.mockResolvedValue({
      id: 9,
      ubicacion_id: 3,
      version: 2,
      estado: 'ARCHIVED',
    });
    const res = makeResponse();

    await controller.archiveVisitForm(makeRequest({ params: { formId: '9' } }), res);

    expect(repository.findLockedVisitFormVersion).toHaveBeenCalledWith({ client, formId: 9 });
    expect(repository.archiveVisitFormVersion).toHaveBeenCalledWith({ client, formId: 9 });
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'bitacora_visit_form_versions', operacion: 'UPDATE' })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Formulario archivado' })
    );
  });

  test('rechaza archivar un formulario que no existe', async () => {
    transactionForCreate({ locationType: 'URBANIZACION', persistedRole: 'gerente' });
    repository.findLockedVisitFormVersion.mockResolvedValue(null);
    const res = makeResponse();

    await controller.archiveVisitForm(makeRequest({ params: { formId: '9' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(repository.archiveVisitFormVersion).not.toHaveBeenCalled();
  });

  test('rechaza archivar un formulario que ya no está activo', async () => {
    transactionForCreate({ locationType: 'URBANIZACION', persistedRole: 'gerente' });
    repository.findLockedVisitFormVersion.mockResolvedValue({
      id: 9,
      ubicacion_id: 3,
      estado: 'ARCHIVED',
    });
    const res = makeResponse();

    await controller.archiveVisitForm(makeRequest({ params: { formId: '9' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(repository.archiveVisitFormVersion).not.toHaveBeenCalled();
  });

  test('registra check-in con Casa, titular, formulario activo, respuestas y Bitácora automática', async () => {
    const client = transactionForCreate({ locationType: 'URBANIZACION' });
    const res = makeResponse();

    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: ' Carlos Ruiz ',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 901,
          placa: 'abc123',
          respuestas: { motivo: 'Entrega', autorizado: true },
        },
      }),
      res
    );

    expect(repository.findActiveVisitFormForLocation).toHaveBeenCalledWith({
      locationId: 3,
      executor: client,
    });
    expect(repository.insertBitacoraRegistro).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        locationId: 3,
        blockId: 8,
        villaId: 9,
        actorUserId: 7,
        actorCollaboratorId: 21,
      })
    );
    expect(repository.createVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        locationId: 3,
        blockId: 8,
        villaId: 9,
        principalResidentId: 15,
        formVersionId: 51,
        visitor: {
          nombre: ' Carlos Ruiz ',
          documento: '0912345678',
          telefono: '0991234567',
          tipoVisitaId: 901,
          placa: 'abc123',
        },
      })
    );
    expect(repository.insertVisitResponses).toHaveBeenCalledWith({
      client,
      visitId: 81,
      fields: expect.any(Array),
      responses: { motivo: 'Entrega', autorizado: true },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('conserva checkbox false como respuesta explícita válida', async () => {
    const client = transactionForCreate({ locationType: 'URBANIZACION' });
    const res = makeResponse();

    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          placa: 'ABC123',
          respuestas: { motivo: 'Entrega', autorizado: false },
        },
      }),
      res
    );

    expect(repository.insertVisitResponses).toHaveBeenCalledWith({
      client,
      visitId: 81,
      fields: expect.any(Array),
      responses: { motivo: 'Entrega', autorizado: false },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('propaga rollback si falla auditoría durante check-in', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    audit.logAuditStrict.mockRejectedValueOnce(new Error('audit visit down'));
    const res = makeResponse();

    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          placa: 'ABC123',
          respuestas: { motivo: 'Entrega' },
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(repository.insertBitacoraRegistro).toHaveBeenCalled();
    expect(repository.createVisit).toHaveBeenCalled();
    expect(audit.logAuditStrict).toHaveBeenCalledTimes(1);
  });

  test('rechaza visita si la Urbanización no tiene formulario activo', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    repository.findActiveVisitFormForLocation.mockResolvedValue(null);
    const res = makeResponse();

    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          placa: 'ABC123',
          respuestas: {},
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ACTIVE_VISIT_FORM_REQUIRED' })
    );
    expect(repository.createVisit).not.toHaveBeenCalled();
  });

  test('valida respuestas dinámicas contra la versión activa', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    const res = makeResponse();

    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          placa: 'ABC123',
          respuestas: { motivo: 'No existe' },
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VISIT_RESPONSE_INVALID' })
    );
    expect(repository.createVisit).not.toHaveBeenCalled();
  });

  test('valida y normaliza respuestas configurables Cédula y Placa', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    repository.findActiveVisitFormForLocation.mockResolvedValue({
      id: 51,
      tipos: [{ id: 900, form_version_id: 51, nombre: 'Peatón', sort_order: 1 }],
      fields: [
        { id: 91, field_key: 'cedula_extra', label: 'Cédula adicional', type: 'cedula' },
        { id: 92, field_key: 'placa_extra', label: 'Placa adicional', type: 'placa' },
      ],
    });
    const invalidRes = makeResponse();
    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          respuestas: { cedula_extra: '123' },
        },
      }),
      invalidRes
    );
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(repository.createVisit).not.toHaveBeenCalled();

    repository.createVisit.mockResolvedValue({ id: 81 });
    const validRes = makeResponse();
    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          respuestas: { cedula_extra: '0912345678', placa_extra: 'abc-123' },
        },
      }),
      validRes
    );
    expect(repository.insertVisitResponses).toHaveBeenCalledWith(
      expect.objectContaining({
        responses: { cedula_extra: '0912345678', placa_extra: 'ABC123' },
      })
    );
  });

  test('exige solo preguntas aplicables y rechaza respuestas de otro tipo de visita', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    repository.findActiveVisitFormForLocation.mockResolvedValue({
      id: 51,
      tipos: [
        { id: 900, form_version_id: 51, nombre: 'Peatón', sort_order: 1 },
        { id: 901, form_version_id: 51, nombre: 'Vehículo', sort_order: 2 },
      ],
      fields: [
        {
          id: 91,
          field_key: 'peaton_detalle',
          label: 'Detalle peatonal',
          type: 'text',
          required: true,
          aplica_a: 'SELECCIONADOS',
          tipos: [900],
        },
        {
          id: 92,
          field_key: 'vehiculo_detalle',
          label: 'Detalle vehicular',
          type: 'text',
          required: true,
          aplica_a: 'SELECCIONADOS',
          tipos: [901],
        },
      ],
    });
    const accepted = makeResponse();
    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          respuestas: { peaton_detalle: 'Puerta principal' },
        },
      }),
      accepted
    );
    expect(accepted.status).toHaveBeenCalledWith(201);

    repository.createVisit.mockClear();
    const rejected = makeResponse();
    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 900,
          respuestas: { peaton_detalle: 'Puerta', vehiculo_detalle: 'No debe aceptarse' },
        },
      }),
      rejected
    );
    expect(rejected.status).toHaveBeenCalledWith(400);
    expect(rejected.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VISIT_RESPONSE_NOT_APPLICABLE' })
    );
    expect(repository.createVisit).not.toHaveBeenCalled();
  });

  test('rechaza un tipo de visita que no pertenece al formulario activo', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    const res = makeResponse();

    await controller.createVisita(
      makeRequest({
        body: {
          ubicacion_id: 3,
          manzana_id: 8,
          villa_id: 9,
          visitante_nombre: 'Carlos Ruiz',
          visitante_documento: '0912345678',
          visitante_telefono: '0991234567',
          tipo_visita_id: 999999,
          respuestas: {},
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VISIT_TYPE_NOT_APPLICABLE' })
    );
    expect(repository.createVisit).not.toHaveBeenCalled();
  });

  test('cierra visita abierta con bloqueo, alcance y Bitácora automática', async () => {
    const client = transactionForCreate({ locationType: 'URBANIZACION' });
    const res = makeResponse();

    await controller.closeVisita(makeRequest({ params: { visitaId: '81' } }), res);

    expect(repository.findLockedVisit).toHaveBeenCalledWith({ client, visitId: 81 });
    expect(repository.insertBitacoraRegistro).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        locationId: 3,
        blockId: 8,
        villaId: 9,
        actorUserId: 7,
      })
    );
    expect(repository.closeVisit).toHaveBeenCalledWith({
      client,
      visitId: 81,
      actorUserId: 7,
      actorCollaboratorId: 21,
      exitLogId: 71,
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Visita cerrada' }));
  });

  test('propaga rollback si falla auditoría durante check-out', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    audit.logAuditStrict.mockRejectedValueOnce(new Error('audit checkout down'));
    const res = makeResponse();

    await controller.closeVisita(makeRequest({ params: { visitaId: '81' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(repository.insertBitacoraRegistro).toHaveBeenCalled();
    expect(repository.closeVisit).toHaveBeenCalled();
    expect(audit.logAuditStrict).toHaveBeenCalledTimes(1);
  });

  test('previene doble checkout si la visita ya no está ABIERTA', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    repository.findLockedVisit.mockResolvedValue({ id: 81, ubicacion_id: 3, estado: 'CERRADA' });
    const res = makeResponse();

    await controller.closeVisita(makeRequest({ params: { visitaId: '81' } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VISIT_ALREADY_CLOSED' })
    );
    expect(repository.closeVisit).not.toHaveBeenCalled();
  });

  test('anula visita abierta con motivo, bloqueo, alcance y Bitácora automática', async () => {
    const client = transactionForCreate({ locationType: 'URBANIZACION' });
    const res = makeResponse();

    await controller.cancelVisita(
      makeRequest({ params: { visitaId: '81' }, body: { motivo: 'Visitante no llegó' } }),
      res
    );

    expect(repository.findLockedVisit).toHaveBeenCalledWith({ client, visitId: 81 });
    expect(repository.insertBitacoraRegistro).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        locationId: 3,
        blockId: 8,
        villaId: 9,
        actorUserId: 7,
      })
    );
    expect(repository.cancelVisit).toHaveBeenCalledWith({
      client,
      visitId: 81,
      actorUserId: 7,
      actorCollaboratorId: 21,
      exitLogId: 71,
      motivo: 'Visitante no llegó',
    });
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        tabla: 'bitacora_visitas',
        operacion: 'UPDATE',
        registro_id: 81,
      })
    );
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: 71,
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Visita anulada' }));
  });

  test('propaga rollback si falla auditoría durante anulación', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    audit.logAuditStrict.mockRejectedValueOnce(new Error('audit cancel down'));
    const res = makeResponse();

    await controller.cancelVisita(
      makeRequest({ params: { visitaId: '81' }, body: { motivo: 'Visitante no llegó' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(repository.insertBitacoraRegistro).toHaveBeenCalled();
    expect(repository.cancelVisit).toHaveBeenCalled();
    expect(audit.logAuditStrict).toHaveBeenCalledTimes(1);
  });

  test('previene anular una visita que ya no está ABIERTA', async () => {
    transactionForCreate({ locationType: 'URBANIZACION' });
    repository.findLockedVisit.mockResolvedValue({ id: 81, ubicacion_id: 3, estado: 'CERRADA' });
    const res = makeResponse();

    await controller.cancelVisita(
      makeRequest({ params: { visitaId: '81' }, body: { motivo: 'Tarde' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VISIT_NOT_OPEN' }));
    expect(repository.cancelVisit).not.toHaveBeenCalled();
  });

  test('consulta historial de visitas con filtros permitidos y creadores reales visibles', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'guardia', activo: true }],
    });
    const res = makeResponse();

    await controller.getVisitas(
      makeRequest({
        query: {
          estado: 'ABIERTA',
          creator: 'ana',
          fecha_desde: '2026-08-01',
          search: 'carlos',
        },
      }),
      res
    );

    expect(repository.findVisits).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          estado: 'ABIERTA',
          creator: 'ana',
          search: 'carlos',
        }),
        hasGlobalScope: false,
        userId: 7,
      })
    );
    expect(repository.findVisitCreators).toHaveBeenCalledWith({
      hasGlobalScope: false,
      userId: 7,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        filters: { creators: [{ id: 21, nombre: 'Guardia Uno' }] },
      })
    );
  });

  test('rechaza filtros de visitas fuera del allowlist', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7, tipo_usuario: 'guardia', activo: true }],
    });
    const res = makeResponse();

    await controller.getVisitas(makeRequest({ query: { placa: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(repository.findVisits).not.toHaveBeenCalled();
  });
});
