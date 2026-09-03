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
const { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } = require('../utils/authErrorCodes');

const userRow = async (overrides = {}) => ({
  id: 7,
  usuario: 'admin',
  nombre: 'Ada',
  apellido: 'Lovelace',
  tipo_usuario: 'gerente',
  activo: true,
  primer_login: false,
  colaborador_id: 4,
  password_hash: await bcrypt.hash('correct-password', 4),
  ...overrides,
});

const mockAuthQuery = ({ loginUser, verifyUser, updateOk = true }) => {
  db.query.mockImplementation(async (sql) => {
    const query = String(sql);
    if (query.includes('information_schema.columns')) {
      return { rows: [{ column_name: 'nombre' }], rowCount: 1 };
    }
    if (query.includes('FROM usuarios') && query.includes('WHERE usuario = $1')) {
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
    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      return verifyUser ? { rows: [verifyUser], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
};

const signToken = (payload = {}) =>
  jwt.sign({ id: 7, usuario: 'admin', tipo_usuario: 'gerente', ...payload }, config.jwt.secret, {
    expiresIn: '1h',
  });

const signExpiredToken = () =>
  jwt.sign({ id: 7, usuario: 'admin', tipo_usuario: 'gerente' }, config.jwt.secret, {
    expiresIn: '-1s',
  });

const expectAuthRequired = (res) => {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({
    success: false,
    code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
    message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED],
  });
  expect(JSON.stringify(res.body)).not.toMatch(/Token|jwt|expired|invalid|stack|secret/i);
};

const expectUserDisabled = (res) => {
  expect(res.status).toBe(403);
  expect(res.body).toEqual({
    success: false,
    code: AUTH_ERROR_CODES.USER_DISABLED,
    message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_DISABLED],
  });
  expect(JSON.stringify(res.body)).not.toMatch(/stack|jwt|authorization|password/i);
};

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
      colaborador_id: 4,
    });
  });

  test('login rechaza usuario inexistente', async () => {
    mockAuthQuery({ loginUser: null });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'ghost', password: 'correct-password' });

    expectAuthRequired(res);
  });

  test('login rechaza password inválido', async () => {
    mockAuthQuery({ loginUser: await userRow() });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'wrong-password' });

    expectAuthRequired(res);
  });

  test('login rechaza usuario inactivo', async () => {
    mockAuthQuery({ loginUser: await userRow({ activo: false }) });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'correct-password' });

    expectUserDisabled(res);
  });

  test('verify rechaza token ausente', async () => {
    const res = await request(app).get('/api/auth/verify');

    expectAuthRequired(res);
  });

  test('verify rechaza token inválido', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer not-a-token');

    expectAuthRequired(res);
  });

  test('verify rechaza token expirado con contrato genérico', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signExpiredToken()}`);

    expectAuthRequired(res);
  });

  test('verify rechaza usuario inexistente con token válido', async () => {
    mockAuthQuery({ verifyUser: null });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expectAuthRequired(res);
  });

  test('verify acepta token válido de usuario activo', async () => {
    const verifyUser = await userRow();
    mockAuthQuery({ verifyUser });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ id: 7, usuario: 'admin', colaborador_id: 4 });
  });

  test('verify expone colaborador_id null para una cuenta sin vínculo válido', async () => {
    mockAuthQuery({ verifyUser: await userRow({ colaborador_id: null }) });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.colaborador_id).toBeNull();
  });

  test('verify rechaza usuario inactivo con token válido', async () => {
    mockAuthQuery({ verifyUser: await userRow({ activo: false }) });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expectUserDisabled(res);
  });

  test('change-password exige usuario activo antes del controlador', async () => {
    mockAuthQuery({
      verifyUser: await userRow({ activo: false }),
    });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ nueva_password: 'new-password-1', confirmar_password: 'new-password-1' });

    expectUserDisabled(res);
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

  test('legacy sin colaborador puede completar el cambio de contraseña de primer login', async () => {
    const legacyUser = await userRow({ colaborador_id: null, primer_login: true });
    mockAuthQuery({ verifyUser: legacyUser });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ nueva_password: 'new-password-1', confirmar_password: 'new-password-1' });

    expect(res.status).toBe(200);
    expect(
      db.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE usuarios SET password_hash'))
    ).toBe(true);
  });
});
