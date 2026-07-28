jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-temp-password'),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, ip: '127.0.0.1' })),
}));

const db = require('../config/database');
const { logAudit } = require('../utils/audit');
const {
  createUsuario,
  updateUsuario,
  reenviarInvitacion,
  deleteUsuario,
} = require('../controllers/usuariosController');

const mockReq = ({ body = {}, params = {}, user = { id: 1 } } = {}) => ({
  body,
  params,
  user,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const expectStatus = (res, status) => {
  expect(res.status).toHaveBeenCalledWith(status);
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
  db.transaction.mockImplementation(async (callback) => callback({ query: db.query }));
});

describe('usuariosController.createUsuario', () => {
  test('crea usuario válido con contraseña temporal', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 2,
          usuario: 'nuevo',
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: 'secretario',
          primer_login: true,
          activo: true,
        },
      ],
      rowCount: 1,
    });
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'nuevo',
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: 'secretario',
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ usuario: 'nuevo', temp_password: expect.any(String) })
    );
    expect(logAudit).toHaveBeenCalledWith(db, expect.objectContaining({ tabla: 'usuarios' }));
  });

  test('rechaza rol inválido', async () => {
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'nuevo',
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: 'admin',
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/inválido/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('reporta usuario duplicado', async () => {
    db.query.mockRejectedValue({ code: '23505' });
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'nuevo',
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: 'secretario',
        },
      }),
      res
    );

    expectStatus(res, 409);
  });
});

describe('usuariosController.updateUsuario', () => {
  test('rechaza desactivar el propio usuario', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 1, tipo_usuario: 'gerente', activo: true }],
      rowCount: 1,
    });
    const res = mockRes();

    await updateUsuario(
      mockReq({ params: { id: '1' }, body: { activo: false }, user: { id: 1 } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/propio usuario/i);
  });

  test('impide dejar el sistema sin gerente activo', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'gerente', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 });
    const res = mockRes();

    await updateUsuario(
      mockReq({ params: { id: '2' }, body: { tipo_usuario: 'secretario' }, user: { id: 1 } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/gerente activo/i);
  });

  test('actualiza usuario válido', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            usuario: 'nuevo',
            nombre: 'Nuevo',
            apellido: 'Editado',
            tipo_usuario: 'secretario',
          },
        ],
        rowCount: 1,
      });
    const res = mockRes();

    await updateUsuario(mockReq({ params: { id: '2' }, body: { apellido: 'Editado' } }), res);

    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ success: true }));
    expect(logAudit).toHaveBeenCalledWith(db, expect.objectContaining({ operacion: 'UPDATE' }));
  });
});

describe('usuariosController.reenviarInvitacion', () => {
  test('rechaza reenvío si el usuario ya completó primer acceso', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 2, usuario: 'activo', primer_login: false, activo: true }],
      rowCount: 1,
    });
    const res = mockRes();

    await reenviarInvitacion(mockReq({ params: { id: '2' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/primer acceso/i);
  });
});

describe('usuariosController.deleteUsuario', () => {
  const noActivity = {
    movimientos: 0,
    movimientos_anulados: 0,
    movimientos_eliminados: 0,
    bajas: 0,
    bajas_anuladas: 0,
    bajas_eliminadas: 0,
    audit_log: 0,
  };

  test('rechaza eliminar el propio usuario', async () => {
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '1' }, user: { id: 1 } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/propio usuario/i);
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('elimina correctamente un usuario secretario sin actividad histórica', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [noActivity], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
    const queries = client.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
    expect(queries.some((sql) => sql.includes('DELETE FROM usuarios'))).toBe(true);
  });

  test('rechaza eliminar un usuario que tiene movimientos', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ ...noActivity, movimientos: 1 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'USER_HAS_ACTIVITY',
      })
    );
    expect(client.query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain(
      'DELETE FROM usuarios'
    );
  });

  test('rechaza eliminar un usuario que tiene registros en audit_log', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ ...noActivity, audit_log: 1 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'USER_HAS_ACTIVITY',
      })
    );
    expect(client.query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain(
      'DELETE FROM usuarios'
    );
  });

  test('traduce error PostgreSQL 23503 a USER_HAS_ACTIVITY', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [noActivity], rowCount: 1 })
      .mockRejectedValueOnce({ code: '23503' });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'USER_HAS_ACTIVITY',
      })
    );
  });

  test('permite eliminar un gerente cuando existen al menos dos gerentes activos', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'gerente', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [noActivity], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
    const queries = client.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
    expect(queries.some((sql) => sql.includes('DELETE FROM usuarios'))).toBe(true);
  });

  test('impide eliminar al último gerente activo', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'gerente', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/gerente activo/i);
    expect(client.query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain(
      'DELETE FROM usuarios'
    );
  });

  test('bloquea la consulta de gerentes activos con FOR UPDATE', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'gerente', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [noActivity], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    const queries = client.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
    expect(
      queries.some(
        (sql) =>
          /FROM usuarios/i.test(sql) &&
          /tipo_usuario = \$1/i.test(sql) &&
          /activo = TRUE/i.test(sql) &&
          /FOR UPDATE/i.test(sql)
      )
    ).toBe(true);
  });
});
