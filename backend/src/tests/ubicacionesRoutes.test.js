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
const {
  findGroupedLocations,
  findGroupedLocationsSource,
} = require('../repositories/ubicacionesGroupedRepository');

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

  test('lista ubicaciones agrupadas sin cambiar el contrato plano', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('SELECT COUNT(*)::int AS total FROM ubicaciones')) {
        return { rows: [{ total: 4 }], rowCount: 1 };
      }

      if (query.includes('FROM clientes c') && !query.includes('LEFT JOIN clientes c')) {
        expect(query).toMatch(/CASE WHEN c\.estado = 'activo' THEN 0 ELSE 1 END/);
        expect(query).toContain('c.nombre ASC');
        return {
          rows: [
            { id: 10, nombre: 'ACME', estado: 'activo', cliente_search_match: false },
            { id: 11, nombre: 'Beta', estado: 'activo', cliente_search_match: false },
          ],
          rowCount: 2,
        };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(query).toContain('LEFT JOIN detalle_movimientos dmo');
        expect(query).toContain('LEFT JOIN inventario_stock_efectos ise');
        expect(query).toContain(
          'COUNT(DISTINCT a.id) FILTER (WHERE a.activo = TRUE)::int AS articulos_activos'
        );
        expect(query).toContain('COUNT(DISTINCT a.id)::int AS articulos_totales');
        expect(query).toContain('ORDER BY c.nombre ASC NULLS LAST, u.nombre ASC, u.id ASC');
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
              puede_eliminar: false,
              ubicacion_search_match: false,
              cliente_search_match: false,
            },
            {
              id: 2,
              nombre: 'Archivo',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: false,
              cliente_search_match: false,
            },
            {
              id: 3,
              nombre: 'Histórica',
              cliente_id: null,
              cliente_nombre: null,
              cliente_estado: null,
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: false,
              cliente_search_match: false,
            },
          ],
          rowCount: 3,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones/agrupadas');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: [
        {
          tipo: 'cliente',
          cliente_id: 10,
          cliente_nombre: 'ACME',
          ubicaciones: [
            { id: 1, nombre: 'Bodega', estado_uso: 'en_uso', puede_eliminar: false },
            { id: 2, nombre: 'Archivo', estado_uso: 'sin_articulos', puede_eliminar: true },
          ],
          resumen: { total: 2, en_uso: 1, disponibles: 1 },
        },
        {
          tipo: 'cliente',
          cliente_id: 11,
          cliente_nombre: 'Beta',
          ubicaciones: [],
          resumen: { total: 0, en_uso: 0, disponibles: 0 },
        },
        {
          tipo: 'sin_cliente',
          cliente_id: null,
          cliente_nombre: 'Sin cliente — dato histórico',
          ubicaciones: [{ id: 3, nombre: 'Histórica', puede_eliminar: true }],
        },
      ],
      meta: {
        page: 1,
        pageSize: 25,
        totalGroups: 3,
        filteredGroups: 3,
        totalLocations: 4,
        filteredLocations: 3,
        totalPages: 1,
      },
    });
  });

  test('ubicaciones agrupadas soporta búsqueda, paginación y flags include', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('SELECT COUNT(*)::int AS total FROM ubicaciones')) {
        return { rows: [{ total: 2 }], rowCount: 1 };
      }

      if (query.includes('FROM clientes c') && !query.includes('LEFT JOIN clientes c')) {
        expect(params).toEqual(['%Bodega%']);
        return {
          rows: [
            { id: 10, nombre: 'ACME', estado: 'activo', cliente_search_match: false },
            { id: 11, nombre: 'Beta', estado: 'activo', cliente_search_match: false },
          ],
          rowCount: 2,
        };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(params).toEqual(['%Bodega%']);
        return {
          rows: [
            {
              id: 1,
              nombre: 'Bodega',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: true,
              cliente_search_match: false,
            },
            {
              id: 2,
              nombre: 'Histórica',
              cliente_id: null,
              cliente_nombre: null,
              cliente_estado: null,
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: true,
              cliente_search_match: false,
            },
          ],
          rowCount: 2,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth(
      'get',
      '/api/inventario/ubicaciones/agrupadas?search=Bodega&page=1&pageSize=10&include_empty=false&include_historical=false'
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      cliente_id: 10,
      ubicaciones: [{ id: 1, nombre: 'Bodega' }],
    });
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 10,
      filteredGroups: 1,
      filteredLocations: 1,
      totalLocations: 2,
      totalPages: 1,
    });
  });

  test('ubicaciones agrupadas muestra todas las ubicaciones cuando la búsqueda coincide con el cliente', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('SELECT COUNT(*)::int AS total FROM ubicaciones')) {
        return { rows: [{ total: 2 }], rowCount: 1 };
      }

      if (query.includes('FROM clientes c') && !query.includes('LEFT JOIN clientes c')) {
        expect(params).toEqual(['%ACME%']);
        return {
          rows: [{ id: 10, nombre: 'ACME', estado: 'activo', cliente_search_match: true }],
          rowCount: 1,
        };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(params).toEqual(['%ACME%']);
        return {
          rows: [
            {
              id: 1,
              nombre: 'Bodega',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: false,
              cliente_search_match: true,
            },
            {
              id: 2,
              nombre: 'Archivo',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: false,
              cliente_search_match: true,
            },
          ],
          rowCount: 2,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones/agrupadas?search=ACME');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ubicaciones.map((ubicacion) => ubicacion.nombre)).toEqual([
      'Bodega',
      'Archivo',
    ]);
    expect(res.body.meta).toMatchObject({
      totalGroups: 1,
      filteredGroups: 1,
      filteredLocations: 2,
    });
  });

  test('ubicaciones agrupadas devuelve metadata vacía para búsqueda sin resultados', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [currentUser], rowCount: 1 };
      }

      if (query.includes('SELECT COUNT(*)::int AS total FROM ubicaciones')) {
        return { rows: [{ total: 1 }], rowCount: 1 };
      }

      if (query.includes('FROM clientes c') && !query.includes('LEFT JOIN clientes c')) {
        expect(params).toEqual(['%zzzz%']);
        return {
          rows: [{ id: 10, nombre: 'ACME', estado: 'activo', cliente_search_match: false }],
          rowCount: 1,
        };
      }

      if (query.includes('FROM ubicaciones u')) {
        expect(params).toEqual(['%zzzz%']);
        return {
          rows: [
            {
              id: 1,
              nombre: 'Bodega',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: false,
              cliente_search_match: false,
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/inventario/ubicaciones/agrupadas?search=zzzz');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 25,
      totalGroups: 1,
      filteredGroups: 0,
      totalLocations: 1,
      filteredLocations: 0,
      totalPages: 0,
    });
  });

  test.each([
    [
      'search demasiado largo',
      `search=${'x'.repeat(101)}`,
      'El filtro de búsqueda no puede exceder 100 caracteres',
    ],
    ['page cero', 'page=0', 'page debe ser mayor o igual a 1'],
    ['page no entero', 'page=abc', 'page debe ser un entero'],
    ['pageSize cero', 'pageSize=0', 'pageSize debe estar entre 10 y 100'],
    ['pageSize sobre máximo', 'pageSize=101', 'pageSize debe estar entre 10 y 100'],
    ['pageSize no entero', 'pageSize=abc', 'pageSize debe ser un entero'],
    ['pageSize fuera de opciones', 'pageSize=11', 'pageSize debe ser uno de 10, 25, 50 o 100'],
    ['include_empty inválido', 'include_empty=maybe', 'El parámetro booleano es inválido'],
    [
      'include_historical inválido',
      'include_historical=maybe',
      'El parámetro booleano es inválido',
    ],
  ])('rechaza parámetros inválidos de ubicaciones agrupadas: %s', async (_case, query, message) => {
    const res = await requestWithAuth('get', `/api/inventario/ubicaciones/agrupadas?${query}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message,
    });
  });

  test('ubicaciones agrupadas usa executor inyectable y consultas parametrizadas', async () => {
    const executor = {
      query: jest.fn(async (sql, params = []) => {
        const query = String(sql);

        if (query.includes('SELECT COUNT(*)::int AS total FROM ubicaciones')) {
          expect(params).toEqual([]);
          return { rows: [{ total: 1 }], rowCount: 1 };
        }

        expect(params).toEqual(['%Bodega%']);
        if (query.includes('FROM clientes c') && !query.includes('LEFT JOIN clientes c')) {
          return {
            rows: [{ id: 10, nombre: 'ACME', estado: 'activo', cliente_search_match: false }],
            rowCount: 1,
          };
        }

        return {
          rows: [
            {
              id: 1,
              nombre: 'Bodega',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: 0,
              articulos_totales: 0,
              puede_eliminar: true,
              ubicacion_search_match: true,
              cliente_search_match: false,
            },
          ],
          rowCount: 1,
        };
      }),
    };

    const result = await findGroupedLocations(
      {
        search: 'Bodega',
        includeEmpty: true,
        includeHistorical: true,
        pagination: { page: 1, pageSize: 25, offset: 0 },
      },
      executor
    );

    expect(executor.query).toHaveBeenCalledTimes(3);
    expect(result.groups[0].ubicaciones).toEqual([
      expect.objectContaining({ nombre: 'Bodega', puede_eliminar: true }),
    ]);
  });

  test('cuenta una sola vez cada artículo aunque existan múltiples relaciones dependientes', async () => {
    const joinedArticleIds = [7, 7, 7, 7];
    const executor = {
      query: jest.fn(async (sql) => {
        const query = String(sql);

        if (query.includes('FROM clientes c') && !query.includes('LEFT JOIN clientes c')) {
          return { rows: [], rowCount: 0 };
        }

        expect(query).toContain('LEFT JOIN detalle_movimientos dmo');
        expect(query).toContain('LEFT JOIN detalle_movimientos dmd');
        expect(query).toContain('LEFT JOIN articulos_bajas ab');
        expect(query).toContain('LEFT JOIN inventario_stock_efectos ise');
        expect(query).toContain(
          'COUNT(DISTINCT a.id) FILTER (WHERE a.activo = TRUE)::int AS articulos_activos'
        );
        expect(query).toContain('COUNT(DISTINCT a.id)::int AS articulos_totales');
        const countsDistinctArticles = query.includes('COUNT(DISTINCT a.id)');
        const articleCount = countsDistinctArticles
          ? new Set(joinedArticleIds).size
          : joinedArticleIds.length;
        return {
          rows: [
            {
              id: 1,
              nombre: 'Bodega',
              cliente_id: 10,
              cliente_nombre: 'ACME',
              cliente_estado: 'activo',
              articulos_activos: articleCount,
              articulos_totales: articleCount,
              puede_eliminar: false,
              ubicacion_search_match: false,
              cliente_search_match: false,
            },
          ],
          rowCount: 1,
        };
      }),
    };

    const source = await findGroupedLocationsSource({ search: '' }, executor);

    expect(source.locations).toEqual([
      expect.objectContaining({ articulos_activos: 1, articulos_totales: 1 }),
    ]);
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
