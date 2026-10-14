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
    if (/UPDATE usuarios\s+SET password_hash/.test(query)) {
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
      db.query.mock.calls.some(([sql]) => /UPDATE usuarios\s+SET password_hash/.test(String(sql)))
    ).toBe(true);
  });
});

describe('contraseña temporal (primer_login) y algoritmo JWT', () => {
  test('con primer_login bloquea el resto del API con PASSWORD_CHANGE_REQUIRED', async () => {
    mockAuthQuery({ verifyUser: await userRow({ primer_login: true }) });

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(AUTH_ERROR_CODES.PASSWORD_CHANGE_REQUIRED);
  });

  test('con primer_login permite /auth/verify', async () => {
    mockAuthQuery({ verifyUser: await userRow({ primer_login: true }) });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
  });

  test('con primer_login permite /auth/change-password', async () => {
    const verifyUser = await userRow({ primer_login: true });
    mockAuthQuery({ verifyUser });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ nueva_password: 'nueva-clave-segura-1', confirmar_password: 'nueva-clave-segura-1' });

    expect(res.status).toBe(200);
  });

  test('rechaza tokens firmados con un algoritmo distinto de HS256', async () => {
    mockAuthQuery({ verifyUser: await userRow() });
    const token = jwt.sign({ id: 7 }, config.jwt.secret, { algorithm: 'HS512' });

    const res = await request(app).get('/api/auth/verify').set('Authorization', `Bearer ${token}`);

    expectAuthRequired(res);
  });
});

describe('bloqueo de cuenta por intentos fallidos', () => {
  const failedLoginUpdates = () =>
    db.query.mock.calls.filter(([sql]) => String(sql).includes('intentos_fallidos + 1'));

  test('un login con contraseña incorrecta registra el intento fallido', async () => {
    const loginUser = await userRow();
    mockAuthQuery({ loginUser });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'incorrecta' });

    expectAuthRequired(res);
    expect(failedLoginUpdates()).toHaveLength(1);
    expect(failedLoginUpdates()[0][1]).toEqual([7, 5, 15]);
  });

  test('el intento que alcanza el máximo responde 429 ACCOUNT_LOCKED', async () => {
    const loginUser = await userRow();
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);
      if (query.includes('information_schema.columns')) {
        return { rows: [{ column_name: 'nombre' }], rowCount: 1 };
      }
      if (query.includes('WHERE usuario = $1')) {
        return { rows: [loginUser], rowCount: 1 };
      }
      if (query.includes('intentos_fallidos + 1')) {
        return { rows: [{ intentos_fallidos: 5, bloqueado_hasta: lockedUntil }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'incorrecta' });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe(AUTH_ERROR_CODES.ACCOUNT_LOCKED);
  });

  test('una cuenta bloqueada rechaza incluso la contraseña correcta sin contar el intento', async () => {
    const loginUser = await userRow({ bloqueado_hasta: new Date(Date.now() + 60 * 1000) });
    mockAuthQuery({ loginUser });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'correct-password' });

    expect(res.status).toBe(429);
    expect(res.body).not.toHaveProperty('data');
    expect(failedLoginUpdates()).toHaveLength(0);
  });

  test('un bloqueo vencido permite entrar y reinicia el contador', async () => {
    const loginUser = await userRow({
      bloqueado_hasta: new Date(Date.now() - 60 * 1000),
      intentos_fallidos: 5,
    });
    mockAuthQuery({ loginUser });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'correct-password' });

    expect(res.status).toBe(200);
    const resets = db.query.mock.calls.filter(([sql]) =>
      String(sql).includes('SET intentos_fallidos = 0')
    );
    expect(resets).toHaveLength(1);
  });
});

describe('política de contraseñas', () => {
  test.each([
    ['solo letras', 'solamenteletras'],
    ['solo números', '1234567890'],
    ['contraseña común', 'Password1'],
  ])('rechaza %s', async (_label, nueva_password) => {
    mockAuthQuery({ verifyUser: await userRow() });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ nueva_password, confirmar_password: nueva_password });

    expect(res.status).toBe(400);
  });
});
