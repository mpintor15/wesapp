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

const token = jwt.sign({ id: 50, usuario: 'gerente', tipo_usuario: 'gerente' }, config.jwt.secret, {
  expiresIn: '1h',
});

const currentUser = {
  id: 50,
  usuario: 'gerente',
  nombre: 'Gerente',
  apellido: 'WES',
  tipo_usuario: 'gerente',
  primer_login: false,
  activo: true,
};

const authorizeUser = () => {
  db.query.mockImplementation(async (sql) => {
    const query = String(sql);

    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      return { rows: [currentUser], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });
};

const requestWithAuth = (method, url) =>
  request(app)[method](url).set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  jest.clearAllMocks();
  authorizeUser();
});

describe('ubicaciones routes', () => {
  test('lista ubicaciones', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('FROM ubicaciones u')) {
        return {
          rows: [
            {
              id: 1,
              nombre: 'Bodega',
              articulos_activos: 2,
              articulos_totales: 3,
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [
        {
          id: 1,
          nombre: 'Bodega',
          articulos_activos: 2,
          articulos_totales: 3,
        },
      ],
    });
  });

  test('crea una ubicación', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Bodega Norte' }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: '  Bodega   Norte  ',
    });

    expect(res.status).toBe(201);
    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING id, nombre',
      ['Bodega Norte']
    );
    expect(res.body).toMatchObject({
      success: true,
      data: { id: 2, nombre: 'Bodega Norte', articulos_activos: 0, articulos_totales: 0 },
    });
  });

  test('rechaza nombre vacío', async () => {
    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: '   ',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'El nombre de la ubicación es obligatorio',
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('rechaza duplicados ignorando mayúsculas/minúsculas', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'bodega',
    });

    expect(res.status).toBe(409);
    expect(client.query).toHaveBeenCalledWith(
      'SELECT id FROM ubicaciones WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1)) LIMIT 1',
      ['bodega']
    );
    expect(res.body).toMatchObject({
      success: false,
      message: 'Ya existe una ubicación con ese nombre',
    });
  });

  test('convierte duplicado detectado por PostgreSQL en 409 controlado', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce({ code: '23505' });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'Bodega',
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Ya existe una ubicación con ese nombre',
    });
  });

  test('edita una ubicación', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 3, nombre: 'Bodega Norte' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 3, nombre: 'Bodega Sur' }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Sur',
    });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE ubicaciones SET nombre = $1 WHERE id = $2 RETURNING id, nombre',
      ['Bodega Sur', 3]
    );
    expect(res.body).toMatchObject({
      success: true,
      data: { id: 3, nombre: 'Bodega Sur' },
    });
  });

  test('responde 404 al editar una inexistente', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/404').send({
      nombre: 'Bodega Fantasma',
    });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Ubicación no encontrada',
    });
  });

  test('responde 400 al editar con ID inválido', async () => {
    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/abc').send({
      nombre: 'Bodega Fantasma',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'La ubicación es inválida',
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('responde 500 controlado sin exponer detalles internos', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('FROM ubicaciones u')) {
        throw new Error('password=secret host=internal-db');
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Error en el servidor',
    });
  });

  test('impide eliminar una ubicación con artículos asociados', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 4, nombre: 'Bodega Uso' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 2 }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/inventario/ubicaciones/4');

    expect(res.status).toBe(409);
    expect(client.query).not.toHaveBeenCalledWith('DELETE FROM ubicaciones WHERE id = $1', [4]);
    expect(res.body).toMatchObject({
      success: false,
      message:
        'No se puede eliminar la ubicación porque tiene artículos asociados. Reasígnalos primero.',
    });
  });

  test('elimina una ubicación sin uso', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 5, nombre: 'Bodega Libre' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/inventario/ubicaciones/5');

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith('DELETE FROM ubicaciones WHERE id = $1', [5]);
    expect(res.body).toMatchObject({
      success: true,
      data: { id: 5, nombre: 'Bodega Libre' },
    });
  });

  test('convierte restricción de referencia al eliminar en 409 controlado', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 6, nombre: 'Bodega Referenciada' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockRejectedValueOnce({ code: '23503' });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/inventario/ubicaciones/6');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'No se puede eliminar la ubicación porque está asociada a registros de inventario.',
    });
  });
});
