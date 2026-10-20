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
  logAudit: jest.fn().mockResolvedValue(undefined),
  logAuditStrict: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, usuario_nombre: 'actor' })),
}));

jest.mock('../repositories/bitacorasRepository', () => ({
  findVisits: jest.fn(),
  findVisitCreators: jest.fn(),
  findVisibleLocations: jest.fn(),
}));

const db = require('../config/database');
const repository = require('../repositories/bitacorasRepository');
const app = require('../app');
const config = require('../config/config');

const tokenFor = (id, tipo_usuario) =>
  jwt.sign({ id, usuario: `u${id}`, tipo_usuario }, config.jwt.secret, { expiresIn: '1h' });

const clienteUser = {
  id: 90,
  usuario: 'urbanizacion1',
  nombre: 'Cliente Uno',
  apellido: 'Cliente',
  tipo_usuario: 'cliente',
  primer_login: false,
  activo: true,
  cliente_id: 7,
};
const gerenteUser = {
  id: 1,
  usuario: 'gerente',
  nombre: 'G',
  apellido: 'W',
  tipo_usuario: 'gerente',
  primer_login: false,
  activo: true,
  cliente_id: null,
};

const mockSession = (user, clienteEstado = 'activo') => {
  db.query.mockImplementation(async (sql) => {
    const query = String(sql);
    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      return { rows: [user], rowCount: 1 };
    }
    if (query.includes('FROM clientes WHERE id = $1')) {
      return { rows: [{ estado: clienteEstado }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  repository.findVisits.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
  repository.findVisitCreators.mockResolvedValue([{ id: 3, nombre: 'Guardia' }]);
  repository.findVisibleLocations.mockResolvedValue([
    { id: 11, nombre: 'Urb', tipo_punto: 'URBANIZACION' },
  ]);
});

describe('portal de clientes', () => {
  test('consulta visitas acotadas al cliente del usuario, ignorando cualquier cliente enviado', async () => {
    mockSession(clienteUser);

    const res = await request(app)
      .get('/api/portal/visitas?cliente_id=999')
      .set('Authorization', `Bearer ${tokenFor(90, 'cliente')}`);

    // cliente_id no es un filtro permitido: se rechaza en lugar de ampliar el alcance.
    expect(res.status).toBe(400);
    expect(repository.findVisits).not.toHaveBeenCalled();

    const ok = await request(app)
      .get('/api/portal/visitas?estado=ABIERTA')
      .set('Authorization', `Bearer ${tokenFor(90, 'cliente')}`);

    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual([{ id: 1 }]);
    expect(repository.findVisits).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 7, hasGlobalScope: false })
    );
    expect(repository.findVisitCreators).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 7, hasGlobalScope: false })
    );
  });

  test('lista solo las urbanizaciones del cliente', async () => {
    mockSession(clienteUser);

    const res = await request(app)
      .get('/api/portal/ubicaciones')
      .set('Authorization', `Bearer ${tokenFor(90, 'cliente')}`);

    expect(res.status).toBe(200);
    expect(repository.findVisibleLocations).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 7 })
    );
  });

  test('es de solo lectura: no existen rutas de escritura', async () => {
    mockSession(clienteUser);
    const auth = { Authorization: `Bearer ${tokenFor(90, 'cliente')}` };

    for (const method of ['post', 'put', 'patch', 'delete']) {
      const res = await request(app)[method]('/api/portal/visitas').set(auth).send({});
      expect(res.status).toBe(404);
    }
  });

  test('un cliente inactivo no puede consultar', async () => {
    mockSession(clienteUser, 'inactivo');

    const res = await request(app)
      .get('/api/portal/visitas')
      .set('Authorization', `Bearer ${tokenFor(90, 'cliente')}`);

    expect(res.status).toBe(403);
    expect(repository.findVisits).not.toHaveBeenCalled();
  });

  test('un usuario de personal, incluso gerente, no puede usar el portal', async () => {
    mockSession(gerenteUser);

    const res = await request(app)
      .get('/api/portal/visitas')
      .set('Authorization', `Bearer ${tokenFor(1, 'gerente')}`);

    expect(res.status).toBe(403);
    expect(repository.findVisits).not.toHaveBeenCalled();
  });

  test.each([
    '/api/bitacoras/visitas',
    '/api/bitacoras/registros',
    '/api/clientes',
    '/api/cuentas/clientes',
    '/api/inventario/articulos',
    '/api/personal/colaboradores',
    '/api/usuarios',
  ])('un usuario cliente no accede a %s', async (path) => {
    mockSession(clienteUser);

    const res = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${tokenFor(90, 'cliente')}`);

    expect(res.status).toBe(403);
  });
});

describe('administración del acceso de un cliente', () => {
  const gerenteAuth = () => ({ Authorization: `Bearer ${tokenFor(1, 'gerente')}` });

  const mockTransaction = ({ urbanizaciones, existingUser, onInsert }) => {
    const client = {
      query: jest.fn(async (sql, params) => {
        const query = String(sql);
        if (query.includes('FROM clientes WHERE id')) {
          return { rowCount: 1, rows: [{ id: 7, nombre: 'Urbanización Sol' }] };
        }
        if (query.includes('FROM ubicaciones')) {
          return { rowCount: 1, rows: [{ total: urbanizaciones }] };
        }
        if (query.includes('FROM usuarios WHERE cliente_id')) {
          return existingUser ? { rowCount: 1, rows: [{ id: 91 }] } : { rowCount: 0, rows: [] };
        }
        if (query.includes('INSERT INTO usuarios')) {
          return onInsert(params);
        }
        return { rowCount: 0, rows: [] };
      }),
    };
    db.transaction.mockImplementation(async (callback) => callback(client));
    return client;
  };

  test('roles sin permiso (contador) no pueden ver ni administrar el acceso', async () => {
    mockSession({ ...gerenteUser, id: 2, tipo_usuario: 'contador' });

    const res = await request(app)
      .get('/api/clientes/7/acceso-portal')
      .set('Authorization', `Bearer ${tokenFor(2, 'contador')}`);

    expect(res.status).toBe(403);
  });

  test('supervisor puede crear el acceso pero no activarlo, restablecerlo ni eliminarlo', async () => {
    const attempt = async (method, url, body = {}) => {
      mockSession({ ...gerenteUser, id: 3, tipo_usuario: 'supervisor' });
      return request(app)
        [method](url)
        .set('Authorization', `Bearer ${tokenFor(3, 'supervisor')}`)
        .send(body);
    };

    // Pasa la autorización y la validación lo rechaza después con 400.
    expect((await attempt('post', '/api/clientes/7/acceso-portal')).status).toBe(400);
    expect((await attempt('get', '/api/clientes/7/acceso-portal')).status).not.toBe(403);
    expect(
      (await attempt('patch', '/api/clientes/7/acceso-portal', { activo: false })).status
    ).toBe(403);
    expect((await attempt('post', '/api/clientes/7/acceso-portal/restablecer')).status).toBe(403);
    expect((await attempt('delete', '/api/clientes/7/acceso-portal')).status).toBe(403);
  });

  test('crear acceso valida el nombre de usuario', async () => {
    mockSession(gerenteUser);

    const res = await request(app)
      .post('/api/clientes/7/acceso-portal')
      .set(gerenteAuth())
      .send({ usuario: 'ab' });

    expect(res.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('rechaza crear acceso si el cliente no tiene urbanizaciones', async () => {
    mockSession(gerenteUser);
    const client = mockTransaction({ urbanizaciones: 0, existingUser: false });

    const res = await request(app)
      .post('/api/clientes/7/acceso-portal')
      .set(gerenteAuth())
      .send({ usuario: 'urb-portal' });

    expect(res.status).toBe(400);
    const inserted = client.query.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO usuarios')
    );
    expect(inserted).toBe(false);
  });

  test('crea el acceso y devuelve la contraseña temporal una sola vez', async () => {
    mockSession(gerenteUser);
    mockTransaction({
      urbanizaciones: 2,
      existingUser: false,
      onInsert: (params) => {
        expect(params[3]).toBe('cliente');
        expect(params[4]).toBe(7);
        return {
          rowCount: 1,
          rows: [
            {
              id: 91,
              usuario: params[0],
              tipo_usuario: 'cliente',
              primer_login: true,
              activo: true,
            },
          ],
        };
      },
    });

    const res = await request(app)
      .post('/api/clientes/7/acceso-portal')
      .set(gerenteAuth())
      .send({ usuario: 'urb-portal' });

    expect(res.status).toBe(201);
    expect(res.body.data.usuario).toBe('urb-portal');
    expect(res.body.data.temp_password).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(res.body.data.password_hash).toBeUndefined();
  });

  test('un segundo usuario para el mismo cliente se rechaza', async () => {
    mockSession(gerenteUser);
    mockTransaction({ urbanizaciones: 1, existingUser: true });

    const res = await request(app)
      .post('/api/clientes/7/acceso-portal')
      .set(gerenteAuth())
      .send({ usuario: 'otro-usuario' });

    expect(res.status).toBe(409);
  });

  test('el usuario de portal no se edita desde Usuarios', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);
      if (query.includes('SELECT id, tipo_usuario, activo, colaborador_id FROM usuarios')) {
        return {
          rows: [{ id: 90, tipo_usuario: 'cliente', activo: true, colaborador_id: null }],
          rowCount: 1,
        };
      }
      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .put('/api/usuarios/90')
      .set(gerenteAuth())
      .send({ activo: false });

    expect(res.status).toBe(400);
  });
});
