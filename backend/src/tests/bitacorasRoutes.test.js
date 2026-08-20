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
  findHistory: jest.fn(),
  findLockedUserLocationAssignment: jest.fn(),
  findVisibleLocations: jest.fn(),
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
  repository.findHistory.mockResolvedValue({ items: [], total: 0 });
  repository.findLockedUserLocationAssignment.mockResolvedValue({
    usuario_id: 50,
    ubicacion_id: 1,
  });
  repository.findVisibleLocations.mockResolvedValue([]);
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
