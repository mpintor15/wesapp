const request = require('supertest');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  healthCheck: jest.fn(),
}));

jest.mock('../utils/movementPdfStorage', () => ({
  checkReady: jest.fn(),
}));

const app = require('../app');
const db = require('../config/database');
const movementPdfStorage = require('../utils/movementPdfStorage');
const { clearActiveCache } = require('../middleware/permissions');
const { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } = require('../utils/authErrorCodes');

const expectAuthenticationRequired = (res) => {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({
    success: false,
    code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
    message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED],
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  clearActiveCache();
  db.healthCheck.mockResolvedValue({
    healthy: true,
    pool: { total: 1, idle: 1, waiting: 0, max: 10 },
  });
  movementPdfStorage.checkReady.mockResolvedValue({ ready: true });
});

describe('routing compatibility', () => {
  test('health route remains reachable without authentication', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('live health route reports process availability', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: 'live' });
  });

  test('ready health route reports database availability', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      status: 'ready',
      database: 'available',
      pdf_storage: 'available',
      pool: { total: 1, idle: 1, waiting: 0 },
    });
  });

  test('ready health route returns 503 when PDF storage is unavailable', async () => {
    movementPdfStorage.checkReady.mockResolvedValueOnce({
      ready: false,
      code: 'EACCES',
    });

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      status: 'not_ready',
      pdf_storage: 'unavailable',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/\/|EACCES|stack/i);
  });

  test('ready health route returns 503 without internal database details', async () => {
    db.healthCheck.mockResolvedValueOnce({
      healthy: false,
      error: 'password authentication failed for user secret_user',
    });

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, status: 'not_ready' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|secret_user|stack|postgres/i);
  });

  test('unknown API route falls through to JSON 404 handler', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Ruta no encontrada',
    });
  });

  test('unregistered method on auth route falls through to API 404', async () => {
    const res = await request(app).get('/api/auth/login');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Ruta no encontrada');
  });

  test('simple protected route still matches before authentication', async () => {
    const res = await request(app).get('/api/cuentas/reporte');

    expectAuthenticationRequired(res);
  });

  test('parameterized personal route still matches before authentication', async () => {
    const res = await request(app).put('/api/personal/colaboradores/123').send({});

    expectAuthenticationRequired(res);
  });

  test('nested parameterized cuentas route still matches before authentication', async () => {
    const res = await request(app).patch('/api/cuentas/facturas/FAC-001/cancelar').send({});

    expectAuthenticationRequired(res);
  });

  test('nested parameterized inventario route still matches before authentication', async () => {
    const res = await request(app).get('/api/inventario/movimientos/42/pdf');

    expectAuthenticationRequired(res);
  });
});
