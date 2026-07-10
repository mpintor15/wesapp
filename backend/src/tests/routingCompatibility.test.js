const request = require('supertest');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const app = require('../app');
const { clearActiveCache } = require('../middleware/permissions');

beforeEach(() => {
  jest.clearAllMocks();
  clearActiveCache();
});

describe('routing compatibility', () => {
  test('health route remains reachable without authentication', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
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

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token no proporcionado/);
  });

  test('parameterized personal route still matches before authentication', async () => {
    const res = await request(app).put('/api/personal/colaboradores/123').send({});

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token no proporcionado/);
  });

  test('nested parameterized cuentas route still matches before authentication', async () => {
    const res = await request(app).patch('/api/cuentas/facturas/FAC-001/cancelar').send({});

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token no proporcionado/);
  });

  test('nested parameterized inventario route still matches before authentication', async () => {
    const res = await request(app).get('/api/inventario/movimientos/42/pdf');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token no proporcionado/);
  });
});
