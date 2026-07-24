const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const db = require('../config/database');
const app = require('../app');
const config = require('../config/config');

const tokenFor = (tipo_usuario, id = 50) =>
  jwt.sign({ id, usuario: `token-${tipo_usuario}-${id}`, tipo_usuario }, config.jwt.secret, {
    expiresIn: '1h',
  });

const userFromDb = (tipo_usuario, overrides = {}) => ({
  id: 50,
  usuario: `db-${tipo_usuario}`,
  nombre: 'Role',
  apellido: 'Current',
  tipo_usuario,
  primer_login: false,
  activo: true,
  ...overrides,
});

const mockCurrentUser = (user) => {
  db.query.mockImplementation(async (sql) => {
    const query = String(sql);

    if (query.includes('FROM usuarios') && query.includes('WHERE id = $1')) {
      return user ? { rows: [user], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (query.includes('information_schema.columns')) {
      return { rows: [{ column_name: 'nombre' }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });
};

const expectAllowedPastAuthorization = (res) => {
  expect(res.status).not.toBe(401);
  expect(res.status).not.toBe(403);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser(userFromDb('gerente'));
});

describe('route protection uses current database role and state', () => {
  test('token emitido como gerente pero degradado a contador pierde acceso gerente', async () => {
    mockCurrentUser(userFromDb('contador'));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expect(res.status).toBe(403);
  });

  test('token emitido como gerente pero usuario desactivado pierde acceso', async () => {
    mockCurrentUser(userFromDb('gerente', { activo: false }));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expect(res.status).toBe(403);
  });

  test('token emitido como supervisor pero ascendido a gerente obtiene acceso gerente', async () => {
    mockCurrentUser(userFromDb('gerente'));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);

    expectAllowedPastAuthorization(res);
  });

  test('usuario inexistente con token válido recibe 401', async () => {
    mockCurrentUser(null);

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expect(res.status).toBe(401);
  });
});

describe('cuentas permissions', () => {
  test('secretario puede crear cliente', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const res = await request(app)
      .post('/api/cuentas/clientes')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expectAllowedPastAuthorization(res);
  });

  test('secretario no puede crear factura', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const res = await request(app)
      .post('/api/cuentas/facturas')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  test('secretario no puede registrar pago o abono', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const res = await request(app)
      .post('/api/cuentas/abonos/batch')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expect(res.status).toBe(403);
  });

  test('secretario puede generar reporte', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const res = await request(app)
      .get('/api/cuentas/reporte')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`);

    expectAllowedPastAuthorization(res);
  });

  test('contador puede ejecutar operaciones de Cuentas', async () => {
    mockCurrentUser(userFromDb('contador'));

    const createFactura = await request(app)
      .post('/api/cuentas/facturas')
      .set('Authorization', `Bearer ${tokenFor('contador')}`)
      .send({});
    const createAbono = await request(app)
      .post('/api/cuentas/abonos/batch')
      .set('Authorization', `Bearer ${tokenFor('contador')}`)
      .send({});

    expectAllowedPastAuthorization(createFactura);
    expectAllowedPastAuthorization(createAbono);
  });

  test('contador no puede anular facturas ni pagos', async () => {
    mockCurrentUser(userFromDb('contador'));

    const cancelFactura = await request(app)
      .patch('/api/cuentas/facturas/1001/cancelar')
      .set('Authorization', `Bearer ${tokenFor('contador')}`)
      .send({ detalle_anulacion: 'Error contable documentado' });
    const voidPago = await request(app)
      .patch('/api/cuentas/pagos/10/anular')
      .set('Authorization', `Bearer ${tokenFor('contador')}`);

    expect(cancelFactura.status).toBe(403);
    expect(voidPago.status).toBe(403);
  });

  test('supervisor recibe 403 en Cuentas', async () => {
    mockCurrentUser(userFromDb('supervisor'));

    const res = await request(app)
      .get('/api/cuentas/reporte')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);

    expect(res.status).toBe(403);
  });
});

describe('inventario permissions', () => {
  test('secretario puede ver y reportar artículos', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const list = await request(app)
      .get('/api/inventario/articulos')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`);
    const report = await request(app)
      .get('/api/inventario/articulos/excel')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`);

    expectAllowedPastAuthorization(list);
    expectAllowedPastAuthorization(report);
  });

  test('secretario no puede crear artículo ni dar de baja', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const create = await request(app)
      .post('/api/inventario/articulos')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});
    const baja = await request(app)
      .post('/api/inventario/articulos/10/baja')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expect(create.status).toBe(403);
    expect(baja.status).toBe(403);
  });

  test('secretario puede crear movimiento', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const res = await request(app)
      .post('/api/inventario/movimientos')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});

    expectAllowedPastAuthorization(res);
  });

  test('supervisor puede crear, editar y dar de baja artículos', async () => {
    mockCurrentUser(userFromDb('supervisor'));

    const create = await request(app)
      .post('/api/inventario/articulos')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`)
      .send({});
    const update = await request(app)
      .put('/api/inventario/articulos/10')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`)
      .send({});
    const baja = await request(app)
      .post('/api/inventario/articulos/10/baja')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`)
      .send({});

    expectAllowedPastAuthorization(create);
    expectAllowedPastAuthorization(update);
    expectAllowedPastAuthorization(baja);
  });

  test('supervisor no puede eliminar artículos ni regenerar PDF', async () => {
    mockCurrentUser(userFromDb('supervisor'));

    const remove = await request(app)
      .delete('/api/inventario/articulos/10')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);
    const regeneratePdf = await request(app)
      .post('/api/inventario/movimientos/10/pdf/regenerar')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);

    expect(remove.status).toBe(403);
    expect(regeneratePdf.status).toBe(403);
  });

  test.each(['gerente', 'secretario', 'supervisor'])(
    '%s puede acceder a descarga de PDF existente',
    async (role) => {
      mockCurrentUser(userFromDb(role));

      const res = await request(app)
        .get('/api/inventario/movimientos/10/pdf')
        .set('Authorization', `Bearer ${tokenFor(role)}`);

      expectAllowedPastAuthorization(res);
    }
  );

  test('contador recibe 403 al descargar PDF de movimiento', async () => {
    mockCurrentUser(userFromDb('contador'));

    const res = await request(app)
      .get('/api/inventario/movimientos/10/pdf')
      .set('Authorization', `Bearer ${tokenFor('contador')}`);

    expect(res.status).toBe(403);
  });

  test('gerente puede acceder a regeneración explícita de PDF', async () => {
    mockCurrentUser(userFromDb('gerente'));

    const res = await request(app)
      .post('/api/inventario/movimientos/10/pdf/regenerar')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expectAllowedPastAuthorization(res);
  });

  test.each(['secretario', 'supervisor', 'contador'])(
    '%s recibe 403 al regenerar PDF de movimiento',
    async (role) => {
      mockCurrentUser(userFromDb(role));

      const res = await request(app)
        .post('/api/inventario/movimientos/10/pdf/regenerar')
        .set('Authorization', `Bearer ${tokenFor(role)}`);

      expect(res.status).toBe(403);
    }
  );

  test.each(['gerente', 'supervisor'])(
    '%s puede acceder a anulación de movimiento',
    async (role) => {
      mockCurrentUser(userFromDb(role));

      const res = await request(app)
        .post('/api/inventario/movimientos/10/anular')
        .set('Authorization', `Bearer ${tokenFor(role)}`)
        .send({ motivo: 'Motivo suficientemente detallado' });

      expectAllowedPastAuthorization(res);
    }
  );

  test.each(['secretario', 'contador'])('%s recibe 403 al anular movimiento', async (role) => {
    mockCurrentUser(userFromDb(role));

    const res = await request(app)
      .post('/api/inventario/movimientos/10/anular')
      .set('Authorization', `Bearer ${tokenFor(role)}`)
      .send({ motivo: 'Motivo suficientemente detallado' });

    expect(res.status).toBe(403);
  });

  test.each(['gerente', 'supervisor'])('%s puede acceder a anulación de baja', async (role) => {
    mockCurrentUser(userFromDb(role));

    const res = await request(app)
      .post('/api/inventario/bajas/10/anular')
      .set('Authorization', `Bearer ${tokenFor(role)}`)
      .send({ motivo: 'Motivo suficientemente detallado' });

    expectAllowedPastAuthorization(res);
  });

  test.each(['secretario', 'contador'])('%s recibe 403 al anular baja', async (role) => {
    mockCurrentUser(userFromDb(role));

    const res = await request(app)
      .post('/api/inventario/bajas/10/anular')
      .set('Authorization', `Bearer ${tokenFor(role)}`)
      .send({ motivo: 'Motivo suficientemente detallado' });

    expect(res.status).toBe(403);
  });

  test('solo gerente puede acceder a eliminación administrativa de movimientos y bajas', async () => {
    mockCurrentUser(userFromDb('gerente'));
    const movimiento = await request(app)
      .delete('/api/inventario/movimientos/10')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`)
      .send({ motivo: 'Motivo suficientemente detallado' });
    const baja = await request(app)
      .delete('/api/inventario/bajas/10')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`)
      .send({ motivo: 'Motivo suficientemente detallado' });

    mockCurrentUser(userFromDb('supervisor'));
    const supervisorMovimiento = await request(app)
      .delete('/api/inventario/movimientos/10')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`)
      .send({ motivo: 'Motivo suficientemente detallado' });

    expectAllowedPastAuthorization(movimiento);
    expectAllowedPastAuthorization(baja);
    expect(supervisorMovimiento.status).toBe(403);
  });

  test('id inválido devuelve 400 en descarga y regeneración de PDF', async () => {
    mockCurrentUser(userFromDb('gerente'));

    const download = await request(app)
      .get('/api/inventario/movimientos/abc/pdf')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);
    const regenerate = await request(app)
      .post('/api/inventario/movimientos/abc/pdf/regenerar')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expect(download.status).toBe(400);
    expect(regenerate.status).toBe(400);
  });

  test('contador recibe 403 en Inventario', async () => {
    mockCurrentUser(userFromDb('contador'));

    const res = await request(app)
      .get('/api/inventario/articulos')
      .set('Authorization', `Bearer ${tokenFor('contador')}`);

    expect(res.status).toBe(403);
  });
});

describe('personal permissions', () => {
  test('secretario puede crear y editar, pero no eliminar', async () => {
    mockCurrentUser(userFromDb('secretario'));

    const create = await request(app)
      .post('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});
    const update = await request(app)
      .put('/api/personal/colaboradores/10')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`)
      .send({});
    const remove = await request(app)
      .delete('/api/personal/colaboradores/10')
      .set('Authorization', `Bearer ${tokenFor('secretario')}`);

    expectAllowedPastAuthorization(create);
    expectAllowedPastAuthorization(update);
    expect(remove.status).toBe(403);
  });

  test('contador solo puede ver', async () => {
    mockCurrentUser(userFromDb('contador'));

    const list = await request(app)
      .get('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('contador')}`);
    const create = await request(app)
      .post('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('contador')}`)
      .send({});

    expectAllowedPastAuthorization(list);
    expect(create.status).toBe(403);
  });

  test('supervisor puede ver y crear, pero no editar ni eliminar', async () => {
    mockCurrentUser(userFromDb('supervisor'));

    const list = await request(app)
      .get('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);
    const create = await request(app)
      .post('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`)
      .send({});
    const update = await request(app)
      .put('/api/personal/colaboradores/10')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`)
      .send({});
    const remove = await request(app)
      .delete('/api/personal/colaboradores/10')
      .set('Authorization', `Bearer ${tokenFor('supervisor')}`);

    expectAllowedPastAuthorization(list);
    expectAllowedPastAuthorization(create);
    expect(update.status).toBe(403);
    expect(remove.status).toBe(403);
  });

  test('gerente puede hacer todo', async () => {
    mockCurrentUser(userFromDb('gerente'));

    const create = await request(app)
      .post('/api/personal/colaboradores')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`)
      .send({});
    const update = await request(app)
      .put('/api/personal/colaboradores/10')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`)
      .send({});
    const remove = await request(app)
      .delete('/api/personal/colaboradores/10')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expectAllowedPastAuthorization(create);
    expectAllowedPastAuthorization(update);
    expectAllowedPastAuthorization(remove);
  });
});

describe('usuarios permissions', () => {
  test('gerente permitido', async () => {
    mockCurrentUser(userFromDb('gerente'));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor('gerente')}`);

    expectAllowedPastAuthorization(res);
  });

  test.each(['secretario', 'contador', 'supervisor'])('%s recibe 403', async (role) => {
    mockCurrentUser(userFromDb(role));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenFor(role)}`);

    expect(res.status).toBe(403);
  });
});
