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
const audit = require('../utils/audit');

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
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 2,
              articulos_totales: 3,
            },
            {
              id: 2,
              nombre: 'Archivo',
              cliente_id: 11,
              cliente_nombre: 'Cliente Inactivo',
              cliente_estado: 'inactivo',
              articulos_activos: 0,
              articulos_totales: 0,
            },
            {
              id: 3,
              nombre: 'Histórica',
              cliente_id: null,
              cliente_nombre: null,
              cliente_estado: null,
              articulos_activos: 0,
              articulos_totales: 0,
            },
          ],
          rowCount: 3,
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
          cliente_id: 10,
          cliente_nombre: 'ACME',
          cliente_estado: 'activo',
          articulos_activos: 2,
          articulos_totales: 3,
        },
        {
          id: 2,
          nombre: 'Archivo',
          cliente_id: 11,
          cliente_nombre: 'Cliente Inactivo',
          cliente_estado: 'inactivo',
          articulos_activos: 0,
          articulos_totales: 0,
        },
        {
          id: 3,
          nombre: 'Histórica',
          cliente_id: null,
          cliente_nombre: null,
          cliente_estado: null,
          articulos_activos: 0,
          articulos_totales: 0,
        },
      ],
    });
  });

  test('consulta cliente_estado sin romper LEFT JOIN ni conteos', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(query).toContain('LEFT JOIN clientes c ON c.id = u.cliente_id');
        expect(query).toContain('c.estado AS cliente_estado');
        expect(query).toContain('COUNT(a.id) FILTER (WHERE a.activo = TRUE)::int');
        expect(query).toContain('GROUP BY u.id, u.nombre, u.cliente_id, c.nombre, c.estado');
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones');

    expect(res.status).toBe(200);
  });

  test('filtra ubicaciones por cliente', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(query).toContain('u.cliente_id = $1');
        expect(params).toEqual([10]);
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones?cliente_id=10');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  test('combina búsqueda parametrizada con filtro por cliente', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(query).toContain('u.cliente_id = $1');
        expect(query).toContain('u.nombre ILIKE $2 OR c.nombre ILIKE $2');
        expect(params).toEqual([10, '%bodega%']);
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth(
      'get',
      '/api/inventario/ubicaciones?cliente_id=10&search=bodega'
    );

    expect(res.status).toBe(200);
  });

  test('filtra ubicaciones históricas sin cliente', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(query).toContain('u.cliente_id IS NULL');
        expect(params).toEqual([]);
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones?sin_cliente=true');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  test('rechaza filtros contradictorios de cliente', async () => {
    const res = await requestWithAuth(
      'get',
      '/api/inventario/ubicaciones?cliente_id=10&sin_cliente=true'
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Los filtros cliente_id y sin_cliente no pueden combinarse',
    });
  });

  test('rechaza búsqueda demasiado larga', async () => {
    const search = 'x'.repeat(101);

    const res = await requestWithAuth('get', `/api/inventario/ubicaciones?search=${search}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'El filtro de búsqueda no puede exceder 100 caracteres',
    });
  });

  test('crea una ubicación', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 10, nombre: 'ACME', estado: 'activo' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 2, nombre: 'Bodega Norte', cliente_id: 10 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ nombre: 'ACME' }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: '  Bodega   Norte  ',
      cliente_id: 10,
    });

    expect(res.status).toBe(201);
    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2) RETURNING id, nombre, cliente_id',
      ['Bodega Norte', 10]
    );
    expect(res.body).toMatchObject({
      success: true,
      data: {
        id: 2,
        nombre: 'Bodega Norte',
        cliente_id: 10,
        cliente_nombre: 'ACME',
        articulos_activos: 0,
        articulos_totales: 0,
      },
    });
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        tabla: 'ubicaciones',
        operacion: 'INSERT',
        registro_id: 2,
        datos_nuevos: expect.objectContaining({
          id: 2,
          nombre: 'Bodega Norte',
          cliente_id: 10,
          cliente_nombre: 'ACME',
        }),
      })
    );
  });

  test('rechaza crear ubicación sin cliente', async () => {
    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'Bodega Norte',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El cliente es obligatorio');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('rechaza crear ubicación con cliente inexistente', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'Bodega Norte',
      cliente_id: 999,
    });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: 'CLIENT_NOT_FOUND',
      message: 'Cliente no encontrado',
    });
  });

  test('rechaza crear ubicación con cliente inactivo', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({
      rows: [{ id: 10, nombre: 'ACME', estado: 'inactivo' }],
      rowCount: 1,
    });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'Bodega Norte',
      cliente_id: 10,
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'CLIENT_INACTIVE',
      message: 'El cliente está inactivo y no puede usarse en nuevas operaciones.',
    });
    expect(client.query).toHaveBeenCalledTimes(1);
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
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 10, nombre: 'ACME', estado: 'activo' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'bodega',
      cliente_id: 10,
    });

    expect(res.status).toBe(409);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE cliente_id = $1'), [
      10,
      'bodega',
    ]);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Ya existe una ubicación con ese nombre para el cliente seleccionado',
    });
  });

  test('convierte duplicado detectado por PostgreSQL en 409 controlado', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 10, nombre: 'ACME', estado: 'activo' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce({ code: '23505' });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/inventario/ubicaciones').send({
      nombre: 'Bodega',
      cliente_id: 10,
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Ya existe una ubicación con ese nombre para el cliente seleccionado',
    });
  });

  test('edita una ubicación', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 10,
            cliente_nombre: 'ACME',
            cliente_estado: 'activo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 11, nombre: 'Cliente Sur', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Bodega Sur', cliente_id: 11 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ nombre: 'Cliente Sur' }], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Sur',
      cliente_id: 11,
    });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE ubicaciones SET nombre = $1, cliente_id = $2 WHERE id = $3 RETURNING id, nombre, cliente_id',
      ['Bodega Sur', 11, 3]
    );
    expect(res.body).toMatchObject({
      success: true,
      data: { id: 3, nombre: 'Bodega Sur', cliente_id: 11, cliente_nombre: 'Cliente Sur' },
    });
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        tabla: 'ubicaciones',
        operacion: 'UPDATE',
        registro_id: 3,
        datos_anteriores: expect.objectContaining({ nombre: 'Bodega Norte', cliente_id: 10 }),
        datos_nuevos: expect.objectContaining({ nombre: 'Bodega Sur', cliente_id: 11 }),
      })
    );
  });

  test('edita ubicación histórica sin cliente conservando cliente_id null', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            nombre: 'Bodega histórica',
            cliente_id: null,
            cliente_nombre: null,
            cliente_estado: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 7, nombre: 'Bodega histórica renombrada', cliente_id: null }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/7').send({
      nombre: 'Bodega histórica renombrada',
      cliente_id: null,
    });

    expect(res.status).toBe(200);
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE ubicaciones SET nombre = $1, cliente_id = $2 WHERE id = $3 RETURNING id, nombre, cliente_id',
      ['Bodega histórica renombrada', null, 7]
    );
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'FROM clientes'
    );
    expect(res.body).toMatchObject({
      success: true,
      data: {
        id: 7,
        nombre: 'Bodega histórica renombrada',
        cliente_id: null,
        cliente_nombre: null,
      },
    });
  });

  test('asigna cliente activo a ubicación histórica sin cliente', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            nombre: 'Bodega histórica',
            cliente_id: null,
            cliente_nombre: null,
            cliente_estado: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, nombre: 'ACME', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 7, nombre: 'Bodega histórica', cliente_id: 10 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/7').send({
      nombre: 'Bodega histórica',
      cliente_id: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { cliente_id: 10, cliente_nombre: 'ACME' },
    });
  });

  test.each([
    ['null', { nombre: 'Bodega asociada', cliente_id: null }],
    ['vacío', { nombre: 'Bodega asociada', cliente_id: '' }],
  ])('rechaza dejar sin cliente una ubicación asociada con cliente_id %s', async (_case, body) => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          nombre: 'Bodega asociada',
          cliente_id: 10,
          cliente_nombre: 'ACME',
          cliente_estado: 'activo',
        },
      ],
      rowCount: 1,
    });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send(body);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'LOCATION_CLIENT_REQUIRED',
      message: 'Una ubicación asociada a un cliente no puede quedar sin cliente',
    });
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'UPDATE ubicaciones'
    );
  });

  test('conserva cliente al editar una ubicación asociada sin enviar cliente_id', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega asociada',
            cliente_id: 10,
            cliente_nombre: 'ACME',
            cliente_estado: 'activo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Bodega asociada renombrada', cliente_id: 10 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega asociada renombrada',
    });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE ubicaciones SET nombre = $1, cliente_id = $2 WHERE id = $3 RETURNING id, nombre, cliente_id',
      ['Bodega asociada renombrada', 10, 3]
    );
    expect(res.body).toMatchObject({
      data: {
        id: 3,
        nombre: 'Bodega asociada renombrada',
        cliente_id: 10,
        cliente_nombre: 'ACME',
      },
    });
  });

  test('edita nombre conservando cliente histórico inactivo', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 15,
            cliente_nombre: 'Cliente Histórico',
            cliente_estado: 'inactivo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Bodega Norte Renombrada', cliente_id: 15 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Norte Renombrada',
      cliente_id: 15,
    });

    expect(res.status).toBe(200);
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('FROM ubicaciones');
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'FROM clientes'
    );
    expect(res.body).toMatchObject({
      success: true,
      data: {
        id: 3,
        nombre: 'Bodega Norte Renombrada',
        cliente_id: 15,
        cliente_nombre: 'Cliente Histórico',
      },
    });
  });

  test('edita payload con dirección ignorada conservando cliente histórico inactivo', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 15,
            cliente_nombre: 'Cliente Histórico',
            cliente_estado: 'inactivo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Bodega Norte', cliente_id: 15 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Norte',
      direccion: 'Av. Histórica',
      cliente_id: 15,
    });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE ubicaciones SET nombre = $1, cliente_id = $2 WHERE id = $3 RETURNING id, nombre, cliente_id',
      ['Bodega Norte', 15, 3]
    );
  });

  test('reasigna desde cliente inactivo hacia cliente activo', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 15,
            cliente_nombre: 'Cliente Histórico',
            cliente_estado: 'inactivo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 11, nombre: 'Cliente Activo', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Bodega Norte', cliente_id: 11 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Norte',
      cliente_id: 11,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { cliente_id: 11, cliente_nombre: 'Cliente Activo' },
    });
  });

  test('rechaza reasignar ubicación hacia cliente inactivo', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 10,
            cliente_nombre: 'ACME',
            cliente_estado: 'activo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 11, nombre: 'Cliente Sur', estado: 'inactivo' }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Sur',
      cliente_id: 11,
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CLIENT_INACTIVE' });
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'UPDATE ubicaciones'
    );
  });

  test('rechaza reasignación entre dos clientes inactivos', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 15,
            cliente_nombre: 'Cliente Histórico',
            cliente_estado: 'inactivo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 16, nombre: 'Cliente Inactivo Nuevo', estado: 'inactivo' }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Norte',
      cliente_id: 16,
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CLIENT_INACTIVE' });
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'UPDATE ubicaciones'
    );
  });

  test('rechaza reasignación hacia cliente inexistente con CLIENT_NOT_FOUND', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 10,
            cliente_nombre: 'ACME',
            cliente_estado: 'activo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Norte',
      cliente_id: 999,
    });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'CLIENT_NOT_FOUND' });
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'UPDATE ubicaciones'
    );
  });

  test('valida cambios de cliente dentro de la transacción', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            nombre: 'Bodega Norte',
            cliente_id: 10,
            cliente_nombre: 'ACME',
            cliente_estado: 'activo',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 11, nombre: 'Cliente Sur', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 3, nombre: 'Bodega Sur', cliente_id: 11 }],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/3').send({
      nombre: 'Bodega Sur',
      cliente_id: 11,
    });

    expect(res.status).toBe(200);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][0]).toContain('FROM clientes');
  });

  test('responde 404 al editar una inexistente', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('put', '/api/inventario/ubicaciones/404').send({
      nombre: 'Bodega Fantasma',
      cliente_id: 10,
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
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Bodega Uso', cliente_id: 10, cliente_nombre: 'ACME' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            articulos: 2,
            movimientos_origen: 0,
            movimientos_destino: 0,
            bajas: 0,
            stock_efectos: 0,
          },
        ],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/inventario/ubicaciones/4');

    expect(res.status).toBe(409);
    expect(client.query).not.toHaveBeenCalledWith('DELETE FROM ubicaciones WHERE id = $1', [4]);
    expect(res.body).toMatchObject({
      success: false,
      code: 'LOCATION_HAS_DEPENDENCIES',
      message:
        'No se puede eliminar la ubicación porque tiene artículos asociados. Reasígnalos primero.',
      details: {
        articulos: 2,
        movimientos_origen: 0,
        movimientos_destino: 0,
        bajas: 0,
        stock_efectos: 0,
      },
    });
  });

  test('impide eliminar una ubicación con historial de movimientos', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 8, nombre: 'Bodega Histórica', cliente_id: 10, cliente_nombre: 'ACME' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            articulos: 0,
            movimientos_origen: 1,
            movimientos_destino: 2,
            bajas: 0,
            stock_efectos: 1,
          },
        ],
        rowCount: 1,
      });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/inventario/ubicaciones/8');

    expect(res.status).toBe(409);
    expect(client.query).not.toHaveBeenCalledWith('DELETE FROM ubicaciones WHERE id = $1', [8]);
    expect(res.body).toMatchObject({
      success: false,
      code: 'LOCATION_HAS_DEPENDENCIES',
      message: 'No se puede eliminar la ubicación porque está asociada a registros de inventario.',
      details: {
        movimientos_origen: 1,
        movimientos_destino: 2,
        stock_efectos: 1,
      },
    });
  });

  test('elimina una ubicación sin uso', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, nombre: 'Bodega Libre', cliente_id: 10, cliente_nombre: 'ACME' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            articulos: 0,
            movimientos_origen: 0,
            movimientos_destino: 0,
            bajas: 0,
            stock_efectos: 0,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('delete', '/api/inventario/ubicaciones/5');

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith('DELETE FROM ubicaciones WHERE id = $1', [5]);
    expect(res.body).toMatchObject({
      success: true,
      data: { id: 5, nombre: 'Bodega Libre' },
    });
    expect(audit.logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        tabla: 'ubicaciones',
        operacion: 'DELETE',
        registro_id: 5,
        datos_anteriores: expect.objectContaining({
          id: 5,
          nombre: 'Bodega Libre',
          cliente_id: 10,
        }),
      })
    );
  });

  test('convierte restricción de referencia al eliminar en 409 controlado', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 6, nombre: 'Bodega Referenciada', cliente_id: 10, cliente_nombre: 'ACME' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            articulos: 0,
            movimientos_origen: 0,
            movimientos_destino: 0,
            bajas: 0,
            stock_efectos: 0,
          },
        ],
        rowCount: 1,
      })
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
