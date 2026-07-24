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
  auditFromReq: jest.fn(() => ({ usuario_id: 50, usuario_nombre: 'gerente' })),
}));

const db = require('../config/database');
const app = require('../app');
const config = require('../config/config');
const { logAudit, logAuditStrict } = require('../utils/audit');

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

const gerenteUser = {
  id: 50,
  usuario: 'gerente',
  nombre: 'Gerente',
  apellido: 'WES',
  tipo_usuario: 'gerente',
  primer_login: false,
  activo: true,
};

const userById = {
  50: gerenteUser,
  51: { ...gerenteUser, id: 51, usuario: 'secretario', tipo_usuario: 'secretario' },
  52: { ...gerenteUser, id: 52, usuario: 'supervisor', tipo_usuario: 'supervisor' },
};

const endpoints = [
  {
    label: 'catálogo',
    url: '/api/clientes/7',
    unauthorizedToken: secretarioToken,
    auditMock: logAuditStrict,
  },
  {
    label: 'cuentas',
    url: '/api/cuentas/clientes/7',
    unauthorizedToken: supervisorToken,
    auditMock: logAudit,
  },
];

const clienteRow = {
  id: 7,
  nombre: 'Cliente Test',
  identificacion: '099001',
  tipo_identificacion: 'RUC',
  telefono: null,
  correo: null,
  direccion: null,
  ciudad: null,
  estado: 'activo',
};

const authorizeUsers = () => {
  db.query.mockImplementation(async (sql, params = []) => {
    const query = String(sql);
    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      const user = userById[Number(params[0])];
      return user ? { rows: [user], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
};

const setupDeletionTransaction = ({
  found = true,
  counts = { ubicaciones: 0, facturas: 0, pagos: 0 },
  deleteError = null,
} = {}) => {
  const client = { query: jest.fn() };
  client.query.mockImplementation(async (sql) => {
    const query = String(sql);
    if (query.includes('FROM clientes') && query.includes('FOR UPDATE')) {
      return found ? { rows: [clienteRow], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (
      query.includes('SELECT') &&
      query.includes('FROM ubicaciones') &&
      query.includes('FROM cuentas') &&
      query.includes('FROM pagos')
    ) {
      return { rows: [counts], rowCount: 1 };
    }
    if (query.startsWith('DELETE FROM clientes')) {
      if (deleteError) {
        throw deleteError;
      }
      return { rows: [{ id: clienteRow.id }], rowCount: 1 };
    }
    throw new Error(`Consulta inesperada en prueba: ${query}`);
  });
  db.transaction.mockImplementation(async (callback) => callback(client));
  return client;
};

const expectNoRelatedDataMutation = (client) => {
  const sql = client.query.mock.calls.map(([query]) => String(query).replace(/\s+/g, ' '));
  expect(sql.some((query) => /DELETE FROM (pagos|cuentas|ubicaciones|abonos)/i.test(query))).toBe(
    false
  );
  expect(sql.some((query) => /UPDATE pagos/i.test(query))).toBe(false);
};

beforeEach(() => {
  jest.clearAllMocks();
  authorizeUsers();
});

describe('política compartida de eliminación de clientes', () => {
  test.each(endpoints)('$label elimina cliente sin relaciones', async ({ url, auditMock }) => {
    const client = setupDeletionTransaction();

    const res = await request(app).delete(url).set('Authorization', `Bearer ${gerenteToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Cliente eliminado exitosamente',
    });
    expect(client.query).toHaveBeenCalledWith(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [7]
    );
    expectNoRelatedDataMutation(client);
    expect(auditMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        tabla: 'clientes',
        operacion: 'DELETE',
        registro_id: '7',
        datos_anteriores: expect.objectContaining({ id: 7 }),
      })
    );
  });

  test.each([
    ['ubicación', { ubicaciones: 1, facturas: 0, pagos: 0 }],
    ['factura', { ubicaciones: 0, facturas: 1, pagos: 0 }],
    ['pago', { ubicaciones: 0, facturas: 0, pagos: 1 }],
    ['varias relaciones', { ubicaciones: 2, facturas: 3, pagos: 4 }],
  ])('ambos endpoints bloquean cliente con %s', async (_label, counts) => {
    for (const { url } of endpoints) {
      jest.clearAllMocks();
      authorizeUsers();
      const client = setupDeletionTransaction({ counts });

      const res = await request(app).delete(url).set('Authorization', `Bearer ${gerenteToken}`);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        code: 'CLIENT_HAS_RELATIONS',
        message:
          'El cliente tiene información relacionada y no puede eliminarse. Desactívalo para conservar el historial.',
        details: counts,
      });
      expect(client.query).not.toHaveBeenCalledWith(
        'DELETE FROM clientes WHERE id = $1 RETURNING id',
        [7]
      );
      expectNoRelatedDataMutation(client);
    }
  });

  test.each(endpoints)('$label conserva cliente_id del pago al bloquear', async ({ url }) => {
    const client = setupDeletionTransaction({ counts: { ubicaciones: 0, facturas: 0, pagos: 1 } });

    const res = await request(app).delete(url).set('Authorization', `Bearer ${gerenteToken}`);

    expect(res.status).toBe(409);
    expect(res.body.details.pagos).toBe(1);
    expectNoRelatedDataMutation(client);
    expect(client.query.mock.calls).not.toContainEqual([
      expect.stringMatching(/UPDATE pagos/i),
      expect.anything(),
    ]);
  });

  test.each(endpoints)('$label responde 404 para cliente inexistente', async ({ url }) => {
    const client = setupDeletionTransaction({ found: false });

    const res = await request(app).delete(url).set('Authorization', `Bearer ${gerenteToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      code: 'CLIENT_NOT_FOUND',
      message: 'Cliente no encontrado',
    });
    expect(client.query).not.toHaveBeenCalledWith(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [7]
    );
  });

  test.each(endpoints)('$label traduce FK inesperada a 409', async ({ url }) => {
    const client = setupDeletionTransaction({
      counts: { ubicaciones: 0, facturas: 0, pagos: 0 },
      deleteError: { code: '23503' },
    });

    const res = await request(app).delete(url).set('Authorization', `Bearer ${gerenteToken}`);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      code: 'CLIENT_HAS_RELATIONS',
      message:
        'El cliente tiene información relacionada y no puede eliminarse. Desactívalo para conservar el historial.',
      details: { ubicaciones: 0, facturas: 0, pagos: 0 },
    });
    expectNoRelatedDataMutation(client);
  });

  test.each(endpoints)('$label segundo intento de eliminación responde 404', async ({ url }) => {
    setupDeletionTransaction({ found: false });

    const res = await request(app).delete(url).set('Authorization', `Bearer ${gerenteToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CLIENT_NOT_FOUND');
  });

  test.each(endpoints)('$label requiere autenticación', async ({ url }) => {
    const res = await request(app).delete(url);

    expect(res.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test.each(endpoints)(
    '$label conserva permisos existentes',
    async ({ url, unauthorizedToken }) => {
      const res = await request(app)
        .delete(url)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
      expect(db.transaction).not.toHaveBeenCalled();
    }
  );
});
