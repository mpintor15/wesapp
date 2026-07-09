const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const db = require('../config/database');
const app = require('../app');
const config = require('../config/config');
const { clearActiveCache } = require('../middleware/permissions');

const userRow = async (overrides = {}) => ({
  id: 7,
  usuario: 'admin',
  nombre: 'Ada',
  apellido: 'Lovelace',
  tipo_usuario: 'gerente',
  activo: true,
  primer_login: false,
  password_hash: await bcrypt.hash('correct-password', 4),
  ...overrides,
});

const mockAuthQuery = ({
  loginUser,
  verifyUser,
  activeForRequireActive = true,
  updateOk = true,
}) => {
  db.query.mockImplementation(async (sql) => {
    const query = String(sql);
    if (query.includes('information_schema.columns')) {
      return { rows: [{ column_name: 'nombre' }], rowCount: 1 };
    }
    if (query === 'SELECT activo FROM usuarios WHERE id = $1') {
      return { rows: [{ activo: activeForRequireActive }], rowCount: 1 };
    }
    if (query.includes('FROM usuarios WHERE usuario = $1')) {
      return loginUser ? { rows: [loginUser], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (query.includes('SELECT password_hash FROM usuarios WHERE id = $1')) {
      return verifyUser
        ? { rows: [{ password_hash: verifyUser.password_hash }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (query.includes('UPDATE usuarios SET password_hash')) {
      return { rows: [], rowCount: updateOk ? 1 : 0 };
    }
    if (query.includes('FROM usuarios WHERE id = $1')) {
      return verifyUser ? { rows: [verifyUser], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
};

const signToken = (payload = {}) =>
  jwt.sign({ id: 7, usuario: 'admin', tipo_usuario: 'gerente', ...payload }, config.jwt.secret, {
    expiresIn: '1h',
  });

beforeEach(() => {
  jest.clearAllMocks();
  clearActiveCache();
});

describe('auth routes', () => {
  test('login exitoso retorna token y datos de usuario', async () => {
    const loginUser = await userRow({ primer_login: true });
    mockAuthQuery({ loginUser });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: ' admin ', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      id: 7,
      usuario: 'admin',
      tipo_usuario: 'gerente',
      primer_login: true,
    });
  });

  test('login rechaza usuario inexistente', async () => {
    mockAuthQuery({ loginUser: null });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'ghost', password: 'correct-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('login rechaza password inválido', async () => {
    mockAuthQuery({ loginUser: await userRow() });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('login rechaza usuario inactivo', async () => {
    mockAuthQuery({ loginUser: await userRow({ activo: false }) });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/desactivado/i);
  });

  test('verify rechaza token ausente', async () => {
    const res = await request(app).get('/api/auth/verify');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token no proporcionado/);
  });

  test('verify rechaza token inválido', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer not-a-token');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token inválido/);
  });

  test('verify acepta token válido de usuario activo', async () => {
    const verifyUser = await userRow();
    mockAuthQuery({ verifyUser });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ id: 7, usuario: 'admin' });
  });

  test('verify rechaza usuario inactivo con token válido', async () => {
    mockAuthQuery({ verifyUser: await userRow({ activo: false }) });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/desactivado/i);
  });

  test('change-password exige usuario activo antes del controlador', async () => {
    mockAuthQuery({
      verifyUser: await userRow(),
      activeForRequireActive: false,
    });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ nueva_password: 'new-password-1', confirmar_password: 'new-password-1' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('change-password cambia password válido y completa primer login', async () => {
    mockAuthQuery({ verifyUser: await userRow() });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ nueva_password: 'new-password-1', confirmar_password: 'new-password-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/actualizada/i);
  });
});
