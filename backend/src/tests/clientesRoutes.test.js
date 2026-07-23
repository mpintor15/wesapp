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
  auditFromReq: jest.fn(() => ({ usuario_id: 50, usuario_nombre: 'gerente' })),
}));

const db = require('../config/database');
const app = require('../app');
const config = require('../config/config');
const { logAuditStrict } = require('../utils/audit');

const gerenteToken = jwt.sign(
  { id: 50, usuario: 'gerente', tipo_usuario: 'gerente' },
  config.jwt.secret,
  { expiresIn: '1h' }
);
const secretarioToken = jwt.sign(
  { id: 51, usuario: 'secretario', tipo_usuario: 'secretario' },
  config.jwt.secret,
  { expiresIn: '1h' }
);

const gerenteUser = {
  id: 50,
  usuario: 'gerente',
  nombre: 'Gerente',
  apellido: 'WES',
  tipo_usuario: 'gerente',
  primer_login: false,
  activo: true,
};

const secretarioUser = {
  ...gerenteUser,
  id: 51,
  usuario: 'secretario',
  tipo_usuario: 'secretario',
};

const authorizeUser = () => {
  db.query.mockImplementation(async (sql, params = []) => {
    const query = String(sql);

    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      return {
        rows: [params[0] === 51 ? secretarioUser : gerenteUser],
        rowCount: 1,
      };
    }

    return { rows: [], rowCount: 0 };
  });
};

const requestWithAuth = (method, url, token = gerenteToken) =>
  request(app)[method](url).set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  jest.clearAllMocks();
  authorizeUser();
});

describe('clientes routes', () => {
  test('lista clientes con totales útiles', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        return {
          rows: [
            {
              id: 1,
              nombre: 'ACME',
              identificacion: '099001',
              tipo_identificacion: 'RUC',
              telefono: '0999999999',
              correo: 'ops@acme.com',
              direccion: null,
              ciudad: 'Quito',
              estado: 'activo',
              ubicaciones_totales: 2,
              created_at: new Date('2026-01-01T00:00:00Z'),
              updated_at: new Date('2026-01-01T00:00:00Z'),
              total_filtrado: 1,
            },
          ],
          rowCount: 1,
        };
      }

      if (query.includes('COUNT(*) FILTER')) {
        return { rows: [{ total: 2, activos: 1, inactivos: 1 }], rowCount: 1 };
      }

      expect(params).toEqual([]);
      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ total: 2, activos: 1, inactivos: 1, filtrados: 1 });
    expect(res.body.data[0].ubicaciones_totales).toBe(2);
    expect(res.body.data[0]).not.toHaveProperty('total_filtrado');
  });

  test('crea un cliente válido normalizando texto', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          nombre: 'Cliente Norte',
          identificacion: '099002',
          tipo_identificacion: 'RUC',
          telefono: '0999999999',
          correo: 'admin@cliente.com',
          direccion: 'Av. Principal',
          ciudad: 'Quito',
          estado: 'activo',
        },
      ],
      rowCount: 1,
    });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: '  Cliente Norte  ',
      identificacion: ' 099002 ',
      tipo_identificacion: ' RUC ',
      telefono: ' 0999999999 ',
      correo: ' ADMIN@CLIENTE.COM ',
      direccion: ' Av. Principal ',
      ciudad: ' Quito ',
    });

    expect(res.status).toBe(201);
    expect(client.query.mock.calls[1][1]).toEqual([
      'Cliente Norte',
      '099002',
      'RUC',
      '0999999999',
      'admin@cliente.com',
      'Av. Principal',
      'Quito',
      'activo',
    ]);
    expect(logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'clientes', operacion: 'INSERT' })
    );
  });

  test('rechaza nombre vacío', async () => {
    const res = await requestWithAuth('post', '/api/clientes').send({ nombre: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'El nombre del cliente es obligatorio',
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('rechaza correo inválido', async () => {
    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente',
      correo: 'correo-invalido',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El correo del cliente es inválido');
  });

  test('rechaza identificación duplicada ignorando mayúsculas y espacios externos', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente Duplicado',
      identificacion: ' ABC-123 ',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Ya existe un cliente con esa identificación');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('LOWER(TRIM($1))'), [
      'ABC-123',
      null,
    ]);
  });

  test('responde 400 con ID inválido', async () => {
    const res = await requestWithAuth('put', '/api/clientes/abc').send({ nombre: 'Cliente' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El cliente es inválido');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('edita un cliente existente', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Cliente Viejo', identificacion: 'A1', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Cliente Nuevo',
            identificacion: 'A1',
            estado: 'inactivo',
          },
        ],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/clientes/3').send({
      nombre: 'Cliente Nuevo',
      identificacion: 'A1',
      estado: 'inactivo',
    });

    expect(res.status).toBe(200);
    expect(client.query.mock.calls[2][0]).toContain('UPDATE clientes');
    expect(client.query.mock.calls[2][1][8]).toBe(3);
    expect(logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'clientes', operacion: 'UPDATE' })
    );
  });

  test('responde 404 al editar un cliente inexistente', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/clientes/404').send({
      nombre: 'Cliente Fantasma',
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Cliente no encontrado');
  });

  test('impide eliminar un cliente con dependencias', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 5, nombre: 'Cliente Uso' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ ubicaciones: 0, facturas: 1, pagos: 0 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/clientes/5');

    expect(res.status).toBe(409);
    expect(client.query).not.toHaveBeenCalledWith(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [5]
    );
    expect(res.body).toMatchObject({
      code: 'CLIENT_HAS_RELATIONS',
      message:
        'El cliente tiene información relacionada y no puede eliminarse. Desactívalo para conservar el historial.',
      details: { ubicaciones: 0, facturas: 1, pagos: 0 },
    });
  });

  test('elimina un cliente sin dependencias', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 6, nombre: 'Cliente Libre' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ ubicaciones: 0, facturas: 0, pagos: 0 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 6 }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/clientes/6');

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [6]
    );
    expect(logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'clientes', operacion: 'DELETE' })
    );
  });

  test('solo gerente puede administrar clientes', async () => {
    const res = await requestWithAuth('post', '/api/clientes', secretarioToken).send({
      nombre: 'Cliente Secretario',
    });

    expect(res.status).toBe(403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('responde 500 controlado sin exponer detalles internos', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        throw new Error('password=secret host=internal-db');
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Error en el servidor',
    });
  });
});
