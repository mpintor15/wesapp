const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  getClient: jest.fn(),
  healthCheck: jest.fn(),
}));

jest.mock('../config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  http: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAuditStrict: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 50, usuario_nombre: 'actor' })),
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
const repository = require('../repositories/bitacorasRepository');
const app = require('../app');
const config = require('../config/config');

const currentUser = {
  id: 50,
  usuario: 'actor',
  nombre: 'Actor',
  apellido: 'Pruebas',
  tipo_usuario: 'guardia',
  primer_login: false,
  activo: true,
};

const token = jwt.sign({ id: 50 }, config.jwt.secret, { expiresIn: '1h' });
const authRequest = (method, url) =>
  request(app)[method](url).set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  jest.clearAllMocks();
  currentUser.tipo_usuario = 'guardia';
  db.query.mockImplementation(async (sql) => {
    if (String(sql).includes('FROM usuarios') && String(sql).includes('WHERE id = $1')) {
      return { rowCount: 1, rows: [currentUser] };
    }
    return { rowCount: 0, rows: [] };
  });
  db.transaction.mockImplementation(async (callback) => {
    const client = {
      query: jest.fn(async (sql) => {
        const text = String(sql);
        if (text.includes('FROM usuarios') && text.includes('WHERE id = $1')) {
          return { rowCount: 1, rows: [{ ...currentUser, colaborador_id: 4 }] };
        }
        if (text.includes('FROM colaboradores')) {
          return { rowCount: 1, rows: [{ id: 4 }] };
        }
        if (text.includes('FROM ubicaciones')) {
          return {
            rowCount: 1,
            rows: [{ id: 1, nombre: 'Urbanización', tipo_punto: 'URBANIZACION' }],
          };
        }
        return { rowCount: 0, rows: [] };
      }),
    };
    return callback(client);
  });
  repository.findHistory.mockResolvedValue({ items: [], total: 0 });
  repository.findLockedUserLocationAssignment.mockResolvedValue({
    usuario_id: 50,
    ubicacion_id: 1,
  });
  repository.findVisibleLocations.mockResolvedValue([]);
  repository.findActiveBlocksForLocation.mockResolvedValue([]);
  repository.findActiveVillasForBlock.mockResolvedValue([]);
  repository.findVisibleBlock.mockResolvedValue({ id: 8, ubicacion_id: 1, estado: 'activo' });
  repository.findVisibleLocation.mockResolvedValue({
    id: 1,
    tipo_punto: 'URBANIZACION',
  });
  repository.findLockedBlock.mockResolvedValue({
    id: 8,
    ubicacion_id: 1,
    estado: 'activo',
  });
  repository.findLockedVilla.mockResolvedValue({ id: 9, manzana_id: 8, estado: 'activo' });
  repository.findActivePrincipalResidentForVilla.mockResolvedValue({
    id: 15,
    villa_id: 9,
    nombre: 'Ana Titular',
    contacto: '0991234567',
  });
  repository.findActiveVisitFormForLocation.mockResolvedValue({
    id: 7,
    tipos: [
      { id: 900, form_version_id: 7, nombre: 'Peatón', sort_order: 1 },
      { id: 901, form_version_id: 7, nombre: 'Vehículo', sort_order: 2 },
    ],
    fields: [],
  });
  repository.findVisitForms.mockResolvedValue({ items: [{ id: 7, version: 1 }], total: 1 });
  repository.findVisitFormCreators.mockResolvedValue([{ id: 50, usuario: 'actor' }]);
  repository.insertBitacoraRegistro.mockResolvedValue({ id: 70 });
  repository.createVisit.mockResolvedValue({ id: 80, estado: 'ABIERTA' });
  repository.findLockedVisit.mockResolvedValue({
    id: 80,
    ubicacion_id: 1,
    manzana_id: 8,
    manzana_nombre: 'A',
    villa_id: 9,
    villa_identificador: '1',
    estado: 'ABIERTA',
    visitante_nombre: 'Ana',
    tipo_visita_id: 901,
    tipo_visita_nombre: 'Vehículo',
    placa: 'ABC123',
  });
  repository.closeVisit.mockResolvedValue({ id: 80, estado: 'CERRADA' });
  repository.cancelVisit.mockResolvedValue({ id: 80, estado: 'ANULADA' });
  repository.findVisits.mockResolvedValue({ items: [], total: 0 });
  repository.findVisitCreators.mockResolvedValue([{ id: 4, nombre: 'Guardia Uno' }]);
  repository.publishVisitFormForLocation.mockResolvedValue({ id: 90, version: 1, fields: [] });
});

describe('bitacoras routes', () => {
  test('requiere autenticación', async () => {
    const response = await request(app).get('/api/bitacoras/registros');
    expect(response.status).toBe(401);
  });

  test('GET /registros exige bitacoras.historial.ver', async () => {
    currentUser.tipo_usuario = 'secretario';
    const response = await authRequest('get', '/api/bitacoras/registros');
    expect(response.status).toBe(403);
    expect(repository.findHistory).not.toHaveBeenCalled();
  });

  test('POST /registros exige bitacoras.registro.crear', async () => {
    currentUser.tipo_usuario = 'monitorista';
    const response = await authRequest('post', '/api/bitacoras/registros').send({
      ubicacion_id: 1,
      ocurrido_at: '2026-08-20T10:00:00',
      detalle: 'Novedad',
    });
    expect(response.status).toBe(403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test.each([
    [{ ubicacion_id: 1, ocurrido_at: 'no-date', detalle: 'Novedad' }, 'ocurrido_at'],
    [{ ubicacion_id: 1, ocurrido_at: '2026-02-30T10:00:00', detalle: 'Novedad' }, 'ocurrido_at'],
    [{ ubicacion_id: 1, ocurrido_at: '2026-08-20T10:00:00Z', detalle: 'Novedad' }, 'ocurrido_at'],
    [{ ubicacion_id: 1, ocurrido_at: '2026-08-20T10:00:00', detalle: ' \t\n ' }, 'detalle'],
    [{ ocurrido_at: '2026-08-20T10:00:00', detalle: 'Novedad' }, 'ubicacion_id'],
    [
      { ubicacion_id: 1, villa_id: 9, ocurrido_at: '2026-08-20T10:00:00', detalle: 'Novedad' },
      'villa_id',
    ],
    [
      { ubicacion_id: 1, manzana_id: 0, ocurrido_at: '2026-08-20T10:00:00', detalle: 'Novedad' },
      'manzana_id',
    ],
    [
      { ubicacion_id: 1, villa_id: -1, ocurrido_at: '2026-08-20T10:00:00', detalle: 'Novedad' },
      'villa_id',
    ],
    [
      {
        ubicacion_id: 1,
        manzana_id: 'abc',
        ocurrido_at: '2026-08-20T10:00:00',
        detalle: 'Novedad',
      },
      'manzana_id',
    ],
    [
      {
        ubicacion_id: 1,
        ocurrido_at: '2026-08-20T10:00:00',
        detalle: 'Novedad',
        residente_id: 3,
      },
      'body',
    ],
    [
      {
        ubicacion_id: 1,
        ocurrido_at: '2026-08-20T10:00:00',
        detalle: 'Novedad',
        estado: 'ANULADA',
      },
      'body',
    ],
    [
      {
        ubicacion_id: 1,
        ocurrido_at: '2026-08-20T10:00:00',
        detalle: 'Novedad',
        autor_usuario_id: 99,
      },
      'body',
    ],
  ])('rechaza payload POST fuera del contrato %#', async (payload, expectedField) => {
    const response = await authRequest('post', '/api/bitacoras/registros').send(payload);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.errors).join(',')).toContain(expectedField);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('POST rechaza contexto urbano incompleto', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ ...currentUser, colaborador_id: 4, tipo_usuario: 'supervisor' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 4 }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, nombre: 'Urbanización', tipo_punto: 'URBANIZACION' }],
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const response = await authRequest('post', '/api/bitacoras/registros').send({
      ubicacion_id: 1,
      ocurrido_at: '2026-08-20T10:00:00',
      detalle: 'Novedad',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('COMPLETE_HOUSE_REQUIRED');
  });

  test.each(['/api/bitacoras/ubicaciones/1/manzanas', '/api/bitacoras/manzanas/8/villas'])(
    'opciones D3 exigen permiso de creación: %s',
    async (url) => {
      currentUser.tipo_usuario = 'monitorista';
      expect((await authRequest('get', url)).status).toBe(403);
    }
  );

  test('GET formulario activo permite Guardia con permiso de registro', async () => {
    const response = await authRequest(
      'get',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/activo'
    );
    expect(response.status).toBe(200);
    expect(repository.findActiveVisitFormForLocation).toHaveBeenCalledWith({ locationId: 1 });
  });

  test('listar formularios exige administración y conserva scope en controller', async () => {
    const denied = await authRequest('get', '/api/bitacoras/formularios-visitas');
    expect(denied.status).toBe(403);

    currentUser.tipo_usuario = 'monitorista';
    const allowed = await authRequest('get', '/api/bitacoras/formularios-visitas');
    expect(allowed.status).toBe(200);
    expect(repository.findVisitForms).toHaveBeenCalled();
  });

  test('reportes respetan los permisos existentes de cada tab', async () => {
    const bitacoras = await authRequest('get', '/api/bitacoras/registros/excel');
    const visitas = await authRequest('get', '/api/bitacoras/visitas/excel');
    const formulariosDenied = await authRequest('get', '/api/bitacoras/formularios-visitas/excel');

    expect(bitacoras.status).toBe(200);
    expect(bitacoras.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(visitas.status).toBe(200);
    expect(visitas.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(formulariosDenied.status).toBe(403);

    currentUser.tipo_usuario = 'monitorista';
    const formularios = await authRequest('get', '/api/bitacoras/formularios-visitas/excel');
    expect(formularios.status).toBe(200);
    expect(formularios.headers['content-type']).toContain('spreadsheetml.sheet');
  });

  test('publicar formulario exige bitacoras.formularios.administrar', async () => {
    const denied = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({ titulo: 'Formulario', fields: [] });
    expect(denied.status).toBe(403);

    currentUser.tipo_usuario = 'monitorista';
    repository.findActiveVisitFormForLocation.mockResolvedValueOnce(null);
    const allowed = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({
      titulo: 'Formulario',
      tipos_visita: ['Peatón'],
      fields: [{ field_key: 'motivo', label: 'Motivo', type: 'text', required: true }],
    });
    expect(allowed.status).toBe(201);
  });

  test('Monitorista no puede editar (reemplazar) un formulario ya publicado; Gerente/Supervisor sí', async () => {
    currentUser.tipo_usuario = 'monitorista';
    const blocked = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({ titulo: 'Formulario', tipos_visita: ['Peatón'], fields: [] });
    expect(blocked.status).toBe(403);
    expect(repository.publishVisitFormForLocation).not.toHaveBeenCalled();

    currentUser.tipo_usuario = 'supervisor';
    const allowed = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({ titulo: 'Formulario', tipos_visita: ['Peatón'], fields: [] });
    expect(allowed.status).toBe(201);
  });

  test('cambiar estado del formulario exige bitacoras.formularios.gestionar', async () => {
    repository.findLockedVisitFormVersion.mockResolvedValue({
      id: 7,
      ubicacion_id: 1,
      estado: 'ACTIVE',
    });
    repository.archiveVisitFormVersion.mockResolvedValue({
      id: 7,
      ubicacion_id: 1,
      estado: 'ARCHIVED',
    });

    const deniedGuardia = await authRequest(
      'post',
      '/api/bitacoras/formularios-visitas/7/archivar'
    ).send({});
    expect(deniedGuardia.status).toBe(403);

    currentUser.tipo_usuario = 'monitorista';
    const deniedMonitorista = await authRequest(
      'post',
      '/api/bitacoras/formularios-visitas/7/archivar'
    ).send({});
    expect(deniedMonitorista.status).toBe(403);
    expect(repository.archiveVisitFormVersion).not.toHaveBeenCalled();

    currentUser.tipo_usuario = 'supervisor';
    const allowed = await authRequest('post', '/api/bitacoras/formularios-visitas/7/archivar').send(
      {}
    );
    expect(allowed.status).toBe(200);
    expect(repository.archiveVisitFormVersion).toHaveBeenCalledWith({
      client: expect.anything(),
      formId: 7,
    });
  });

  test('Guardia registra y cierra visitas, pero no anula', async () => {
    const create = await authRequest('post', '/api/bitacoras/visitas').send({
      ubicacion_id: 1,
      manzana_id: 8,
      villa_id: 9,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 901,
      placa: 'ABC123',
      respuestas: {},
    });
    expect(create.status).toBe(201);

    const close = await authRequest('post', '/api/bitacoras/visitas/80/cerrar').send({});
    expect(close.status).toBe(200);

    const cancel = await authRequest('post', '/api/bitacoras/visitas/80/anular').send({
      motivo: 'Error',
    });
    expect(cancel.status).toBe(403);
    expect(repository.cancelVisit).not.toHaveBeenCalled();
  });

  test('Monitorista con bitacoras.formularios.administrar sí puede anular y genera Bitácora', async () => {
    currentUser.tipo_usuario = 'monitorista';

    const response = await authRequest('post', '/api/bitacoras/visitas/80/anular').send({
      motivo: 'Visitante no llegó',
    });

    expect(response.status).toBe(200);
    expect(repository.insertBitacoraRegistro).toHaveBeenCalled();
    expect(repository.cancelVisit).toHaveBeenCalledWith(
      expect.objectContaining({ visitId: 80, motivo: 'Visitante no llegó' })
    );
  });

  test('valida payload estricto de visitas y formularios', async () => {
    const visit = await authRequest('post', '/api/bitacoras/visitas').send({
      ubicacion_id: 1,
      manzana_id: 8,
      villa_id: 9,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 901,
      placa: 'ABC123',
      actor: 99,
      respuestas: {},
    });
    expect(visit.status).toBe(400);

    currentUser.tipo_usuario = 'monitorista';
    const form = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({
      tipos_visita: ['Peatón'],
      fields: [{ field_key: 'motivo', label: 'Motivo', type: 'select', options: [] }],
    });
    expect(form.status).toBe(400);
  });

  test('acepta visitas sin placa para cualquier tipo (placa ya no es exclusiva de un tipo)', async () => {
    const pedestrian = await authRequest('post', '/api/bitacoras/visitas').send({
      ubicacion_id: 1,
      manzana_id: 8,
      villa_id: 9,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 900,
      respuestas: {},
    });
    expect(pedestrian.status).toBe(201);

    const vehicle = await authRequest('post', '/api/bitacoras/visitas').send({
      ubicacion_id: 1,
      manzana_id: 8,
      villa_id: 9,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 901,
      respuestas: {},
    });
    expect(vehicle.status).toBe(201);
  });

  test('rechaza un tipo_visita_id que no pertenece al formulario activo', async () => {
    const response = await authRequest('post', '/api/bitacoras/visitas').send({
      ubicacion_id: 1,
      manzana_id: 8,
      villa_id: 9,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 999999,
      respuestas: {},
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VISIT_TYPE_NOT_APPLICABLE');
    expect(repository.createVisit).not.toHaveBeenCalled();
  });

  test('Cédula exige exactamente 10 dígitos numéricos', async () => {
    const response = await authRequest('post', '/api/bitacoras/visitas').send({
      ubicacion_id: 1,
      manzana_id: 8,
      villa_id: 9,
      visitante_nombre: 'Ana',
      visitante_documento: '09123A5678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 900,
      respuestas: {},
    });
    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveProperty('visitante_documento');
    expect(repository.createVisit).not.toHaveBeenCalled();
  });

  test('acepta publicar preguntas con una clave técnica válida generada por el cliente', async () => {
    currentUser.tipo_usuario = 'supervisor';
    const response = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({
      tipos_visita: ['Peatón'],
      fields: [
        {
          field_key: 'persona_a_visitar',
          label: '¿Persona a visitar?',
          type: 'text',
          required: true,
          options: [],
        },
      ],
    });
    expect(response.status).toBe(201);
    expect(repository.publishVisitFormForLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        tiposVisita: ['Peatón'],
        fields: [
          {
            field_key: 'persona_a_visitar',
            label: '¿Persona a visitar?',
            type: 'text',
            required: true,
            aplica_a: 'TODOS',
            options: [],
          },
        ],
      })
    );
  });

  test('formularios acepta Cédula/Placa y rechaza Fecha/Hora', async () => {
    currentUser.tipo_usuario = 'supervisor';
    const allowed = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({
      tipos_visita: ['Peatón'],
      fields: [
        { field_key: 'cedula_contacto', label: 'Cédula', type: 'cedula', options: [] },
        { field_key: 'placa_alterna', label: 'Placa', type: 'placa', options: [] },
      ],
    });
    expect(allowed.status).toBe(201);

    const denied = await authRequest(
      'post',
      '/api/bitacoras/ubicaciones/1/formulario-visitas/publicar'
    ).send({
      tipos_visita: ['Peatón'],
      fields: [{ field_key: 'fecha', label: 'Fecha', type: 'date', options: [] }],
    });
    expect(denied.status).toBe(400);
    expect(denied.body.errors['fields.0.type']).toBeDefined();
  });

  test('Villas no distingue Manzana inexistente de Manzana fuera de scope', async () => {
    repository.findVisibleBlock.mockResolvedValue(null);
    const missing = await authRequest('get', '/api/bitacoras/manzanas/999/villas');
    const outsideScope = await authRequest('get', '/api/bitacoras/manzanas/18/villas');
    expect(missing.status).toBe(404);
    expect(outsideScope.status).toBe(404);
    expect(outsideScope.body).toEqual(missing.body);
    expect(outsideScope.body).not.toHaveProperty('data');
    expect(repository.findActiveVillasForBlock).not.toHaveBeenCalled();
  });

  test('Manzanas no distingue Ubicación inexistente de Ubicación fuera de scope', async () => {
    repository.findVisibleLocation.mockResolvedValue(null);
    const missing = await authRequest('get', '/api/bitacoras/ubicaciones/999/manzanas');
    const outsideScope = await authRequest('get', '/api/bitacoras/ubicaciones/2/manzanas');
    expect(missing.status).toBe(404);
    expect(outsideScope.status).toBe(404);
    expect(outsideScope.body).toEqual(missing.body);
    expect(outsideScope.body).not.toHaveProperty('data');
    expect(repository.findActiveBlocksForLocation).not.toHaveBeenCalled();
  });

  test('ver_todos conserva acceso a Villas activas de otra Urbanización', async () => {
    currentUser.tipo_usuario = 'supervisor';
    repository.findVisibleBlock.mockResolvedValue({ id: 18, ubicacion_id: 2, estado: 'activo' });
    repository.findLockedBlock.mockResolvedValue({ id: 18, ubicacion_id: 2, estado: 'activo' });
    repository.findActiveVillasForBlock.mockResolvedValue([
      {
        id: 19,
        identificador: 'B-1',
        residente_principal_id: 29,
        residente_principal_nombre: 'Ana Titular',
        residente_principal_contacto: '0991234567',
      },
    ]);
    const client = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 2, nombre: 'B', tipo_punto: 'URBANIZACION' }],
      }),
    };
    db.transaction.mockImplementation(async (callback) => callback(client));
    const response = await authRequest('get', '/api/bitacoras/manzanas/18/villas');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: 19,
        identificador: 'B-1',
        residente_principal_id: 29,
        residente_principal_nombre: 'Ana Titular',
        residente_principal_contacto: '0991234567',
      },
    ]);
  });

  test('POST acepta únicamente el contrato permitido', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 50,
            usuario: 'actor',
            tipo_usuario: 'guardia',
            colaborador_id: 4,
            activo: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 4 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, nombre: 'Punto' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 10,
            ubicacion_id: 1,
            autor_usuario_id: 50,
            autor_colaborador_id: 4,
            ocurrido_at: '2026-08-20T15:00:00.000Z',
            detalle: 'Novedad',
            estado: 'REGISTRADA',
            created_at: '2026-08-20T15:01:00.000Z',
          },
        ],
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const response = await authRequest('post', '/api/bitacoras/registros').send({
      ubicacion_id: 1,
      ocurrido_at: '2026-08-20T10:00:00',
      detalle: 'Novedad',
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(expect.objectContaining({ id: 10, estado: 'REGISTRADA' }));
  });

  test.each(['guardia', 'supervisor', 'monitorista'])(
    'GET /ubicaciones acepta permiso operativo de Bitácoras para %s',
    async (role) => {
      currentUser.tipo_usuario = role;
      const response = await authRequest('get', '/api/bitacoras/ubicaciones');
      expect(response.status).toBe(200);
    }
  );

  test('GET /ubicaciones rechaza usuario sin permisos de Bitácoras', async () => {
    currentUser.tipo_usuario = 'secretario';
    const response = await authRequest('get', '/api/bitacoras/ubicaciones');
    expect(response.status).toBe(403);
  });

  test.each([
    ['put', '/api/bitacoras/registros/1'],
    ['patch', '/api/bitacoras/registros/1'],
    ['delete', '/api/bitacoras/registros/1'],
  ])('no expone operaciones mutables fuera de POST: %s %s', async (method, url) => {
    const response = await authRequest(method, url);
    expect(response.status).toBe(404);
  });
});
