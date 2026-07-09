const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const db = require('../config/database');
const app = require('../app');
const config = require('../config/config');
const { clearActiveCache } = require('../middleware/permissions');

const tokenFor = (tipo_usuario, id = 50) =>
  jwt.sign({ id, usuario: `user-${id}`, tipo_usuario }, config.jwt.secret, { expiresIn: '1h' });

beforeEach(() => {
  jest.clearAllMocks();
  clearActiveCache();
  db.query.mockResolvedValue({ rows: [{ activo: true }], rowCount: 1 });
});

describe('route protection', () => {
  test('inventario mutable rechaza token ausente', async () => {
    const res = await request(app).post('/api/inventario/articulos').send({});

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token no proporcionado/);
  });

  test('contador no puede acceder a inventario', async () => {
    const res = await request(app)
      .post('/api/inventario/articulos')
      .set('Authorization', `Bearer ${tokenFor('contador')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  test('supervisor no puede eliminar definitivamente artículos', async () => {
    const res = await request(app)
      .delete('/api/inventario/articulos/10')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);

    expect(res.status).toBe(403);
  });

  test('secretario no puede gestionar usuarios', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  test('contador no puede crear colaboradores', async () => {
    const res = await request(app)
      .post('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('contador')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  test('secretario no puede crear facturas', async () => {
    const res = await request(app)
      .post('/api/cuentas/facturas')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expect(res.status).toBe(403);
  });
});
