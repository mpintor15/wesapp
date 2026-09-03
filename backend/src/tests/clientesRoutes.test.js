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
const supervisorToken = jwt.sign(
  { id: 52, usuario: 'supervisor', tipo_usuario: 'supervisor' },
  config.jwt.secret,
  { expiresIn: '1h' }
);
const contadorToken = jwt.sign(
  { id: 53, usuario: 'contador', tipo_usuario: 'contador' },
  config.jwt.secret,
  { expiresIn: '1h' }
);
const sinPermisosToken = jwt.sign(
  { id: 54, usuario: 'sin_permisos', tipo_usuario: 'sin_permisos' },
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

const supervisorUser = {
  ...gerenteUser,
  id: 52,
  usuario: 'supervisor',
  tipo_usuario: 'supervisor',
};

const contadorUser = {
  ...gerenteUser,
  id: 53,
  usuario: 'contador',
  tipo_usuario: 'contador',
};

const sinPermisosUser = {
  ...gerenteUser,
  id: 54,
  usuario: 'sin_permisos',
  tipo_usuario: 'sin_permisos',
};

const authorizeUser = () => {
  db.query.mockImplementation(async (sql, params = []) => {
    const query = String(sql);

    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      const usersById = new Map([
        [50, gerenteUser],
        [51, secretarioUser],
        [52, supervisorUser],
        [53, contadorUser],
        [54, sinPermisosUser],
      ]);
      return {
        rows: [usersById.get(params[0]) || gerenteUser],
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
  test('lista opciones mínimas para ubicaciones con permiso de crear ubicaciones', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [supervisorUser], rowCount: 1 };
      }

      if (query.includes('SELECT id, nombre, estado') && query.includes('FROM clientes')) {
        expect(params).toEqual(['activo']);
        expect(query).toContain('WHERE estado = $1');
        expect(query).not.toContain('identificacion');
        expect(query).not.toContain('correo');
        expect(query).not.toContain('telefono');
        expect(query).not.toContain('direccion');
        return {
          rows: [{ id: 1, nombre: 'ACME', estado: 'activo' }],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes/opciones-ubicaciones', supervisorToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ id: 1, nombre: 'ACME', estado: 'activo' }],
    });
    expect(res.body.data[0]).not.toHaveProperty('identificacion');
    expect(res.body.data[0]).not.toHaveProperty('correo');
  });

  test('rechaza opciones de ubicaciones para rol sin permisos relevantes', async () => {
    const res = await requestWithAuth(
      'get',
      '/api/clientes/opciones-ubicaciones',
      sinPermisosToken
    );

    expect(res.status).toBe(403);
  });

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
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  test('lista clientes pagina server-side con page/pageSize y no carga todo el dataset', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        expect(query).toContain('LIMIT $1 OFFSET $2');
        expect(params).toEqual([10, 10]);
        return {
          rows: [{ id: 3, nombre: 'Cliente B', ubicaciones_totales: 0, total_filtrado: 12 }],
          rowCount: 1,
        };
      }

      if (query.includes('COUNT(*) FILTER')) {
        return { rows: [{ total: 12, activos: 12, inactivos: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes?page=2&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 12,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  test('filtra por ubicacionId (EXISTS) y estadoUbicaciones (con_ubicaciones)', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        expect(query).toContain('EXISTS (');
        expect(query).toContain('ubicaciones.id = $1');
        expect(query).toContain('COALESCE(ubicaciones_cliente.ubicaciones_totales, 0) > 0');
        expect(params).toEqual([7, 25, 0]);
        return { rows: [], rowCount: 0 };
      }

      if (query.includes('COUNT(*) FILTER')) {
        return { rows: [{ total: 0, activos: 0, inactivos: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth(
      'get',
      '/api/clientes?ubicacionId=7&estadoUbicaciones=con_ubicaciones'
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  test('busca por teléfono normalizando dígitos', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        expect(query).toContain('regexp_replace(COALESCE(clientes.telefono');
        // El núcleo del teléfono le quita el 0 inicial o el prefijo de país
        // 593 (uno de los dos), así "0999999999" y "+593999999999" comparan
        // igual.
        expect(params).toEqual(['%0999999999%', '999999999', 25, 0]);
        return { rows: [], rowCount: 0 };
      }

      if (query.includes('COUNT(*) FILTER')) {
        return { rows: [{ total: 0, activos: 0, inactivos: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes?search=0999999999');

    expect(res.status).toBe(200);
  });

  test('busca por teléfono normalizando el prefijo internacional 593', async () => {
    db.query.mockImplementation(async (sql, params = []) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [gerenteUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        expect(params).toEqual(['%+593999999999%', '999999999', 25, 0]);
        return { rows: [], rowCount: 0 };
      }

      if (query.includes('COUNT(*) FILTER')) {
        return { rows: [{ total: 0, activos: 0, inactivos: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes?search=%2B593999999999');

    expect(res.status).toBe(200);
  });

  test('rechaza estadoUbicaciones inválido sin ejecutar query', async () => {
    const res = await requestWithAuth('get', '/api/clientes?estadoUbicaciones=otro');

    expect(res.status).toBe(400);
  });

  test('rechaza ubicacionId inválido sin ejecutar query', async () => {
    const res = await requestWithAuth('get', '/api/clientes?ubicacionId=abc');

    expect(res.status).toBe(400);
  });

  test('crea un cliente válido normalizando texto', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          nombre: 'Cliente Norte',
          identificacion: '0999999999001',
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
      identificacion: ' 0999999999001 ',
      tipo_identificacion: ' RUC ',
      telefono: ' 0999999999 ',
      correo: ' ADMIN@CLIENTE.COM ',
      direccion: ' Av. Principal ',
      ciudad: ' Quito ',
    });

    expect(res.status).toBe(201);
    expect(client.query.mock.calls[1][1]).toEqual([
      'Cliente Norte',
      '0999999999001',
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

  test('rechaza tipo de identificación inválido', async () => {
    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente',
      tipo_identificacion: 'DNI',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El tipo de identificación es inválido');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('rechaza cédula con longitud o formato inválido', async () => {
    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente',
      tipo_identificacion: 'CEDULA',
      identificacion: '12345',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La cédula debe tener exactamente 10 dígitos numéricos');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('rechaza RUC con longitud o formato inválido', async () => {
    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente',
      tipo_identificacion: 'RUC',
      identificacion: 'ABC1234567890',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El RUC debe tener exactamente 13 dígitos numéricos');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('acepta pasaporte sin validar longitud ni formato numérico', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({
      rows: [
        {
          id: 4,
          nombre: 'Cliente Extranjero',
          identificacion: 'AB12345',
          tipo_identificacion: 'PASAPORTE',
        },
      ],
      rowCount: 1,
    });
    db.transaction.mockImplementation(async (callback) => callback(client));

    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente Extranjero',
      tipo_identificacion: 'PASAPORTE',
      identificacion: 'AB12345',
    });

    expect(res.status).toBe(201);
  });

  test('rechaza teléfono con longitud o formato inválido', async () => {
    const res = await requestWithAuth('post', '/api/clientes').send({
      nombre: 'Cliente',
      telefono: '099123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El teléfono debe tener exactamente 10 dígitos numéricos');
    expect(db.transaction).not.toHaveBeenCalled();
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

  test('permiso de ubicaciones no concede crear, editar ni eliminar clientes', async () => {
    const create = await requestWithAuth('post', '/api/clientes', supervisorToken).send({
      nombre: 'Cliente Supervisor',
    });
    const update = await requestWithAuth('put', '/api/clientes/1', supervisorToken).send({
      nombre: 'Cliente Supervisor',
    });
    const remove = await requestWithAuth('delete', '/api/clientes/1', supervisorToken);

    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(remove.status).toBe(403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('secretario conserva creación de clientes sin edición ni eliminación administrativa', async () => {
    const create = await requestWithAuth('post', '/api/clientes', secretarioToken).send({});
    const update = await requestWithAuth('put', '/api/clientes/1', secretarioToken).send({
      nombre: 'Cliente Secretario',
    });
    const remove = await requestWithAuth('delete', '/api/clientes/1', secretarioToken);

    expect(create.status).not.toBe(403);
    expect(update.status).toBe(403);
    expect(remove.status).toBe(403);
  });

  test('contador conserva acceso al catálogo administrativo de clientes', async () => {
    db.query.mockImplementation(async (sql) => {
      const query = String(sql);

      if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
        return { rows: [contadorUser], rowCount: 1 };
      }

      if (query.includes('COUNT(*) OVER()::int')) {
        return {
          rows: [{ id: 1, nombre: 'ACME', estado: 'activo', total_filtrado: 1 }],
          rowCount: 1,
        };
      }

      if (query.includes('COUNT(*) FILTER')) {
        return { rows: [{ total: 1, activos: 1, inactivos: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const res = await requestWithAuth('get', '/api/clientes', contadorToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ id: 1, nombre: 'ACME', estado: 'activo' });
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
