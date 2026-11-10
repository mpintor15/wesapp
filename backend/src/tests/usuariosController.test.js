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
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { logAudit } = require('../utils/audit');
const {
  expandAccesos,
  permisosDeUsuario,
  validateAccesos,
} = require('../config/cuentaModuloAccess');
const {
  usuarioCreateSchema,
  usuarioUpdateSchema,
  cuentaModuloCreateSchema,
  cuentaModuloUpdateSchema,
} = require('../utils/validationSchemas');
const {
  createUsuario,
  createCuentaModulo,
  getCuentasModulo,
  updateCuentaModulo,
  reenviarInvitacionCuentaModulo,
  getUsuarios,
  getColaboradoresElegibles,
  getUbicacionesAsignables,
  updateUsuario,
  reenviarInvitacion,
  deleteUsuario,
} = require('../controllers/usuariosController');

const mockReq = ({
  body = {},
  params = {},
  query = {},
  user = { id: 1, tipo_usuario: 'gerente' },
} = {}) => ({
  body,
  params,
  query,
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
  db.query.mockReset();
  db.transaction.mockImplementation(async (callback) => callback({ query: db.query }));
});

describe('usuarios validation schemas', () => {
  test('exige colaborador al crear y rechaza eliminarlo al editar', () => {
    const base = {
      usuario: 'nuevo',
      nombre: 'Nuevo',
      apellido: 'Usuario',
      tipo_usuario: 'guardia',
    };
    expect(() => usuarioCreateSchema.parse(base)).toThrow();
    expect(() => usuarioCreateSchema.parse({ ...base, colaborador_id: null })).toThrow();
    expect(usuarioCreateSchema.parse({ ...base, colaborador_id: '7' }).colaborador_id).toBe(7);
    expect(() => usuarioUpdateSchema.parse({ colaborador_id: null })).toThrow();
  });

  test('rechazan ids de colaborador inválidos', () => {
    expect(() =>
      usuarioCreateSchema.parse({
        usuario: 'nuevo',
        nombre: 'Nuevo',
        apellido: 'Usuario',
        tipo_usuario: 'guardia',
        colaborador_id: 'abc',
      })
    ).toThrow();
  });
});

describe('usuariosController.getUsuarios', () => {
  test('devuelve metadata estándar y limita la consulta sin alterar filtros', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 7,
          usuario: 'guardia.qa',
          nombre: 'Guardia',
          apellido: 'QA',
          total_count: 26,
        },
      ],
    });
    const res = mockRes();

    await getUsuarios(mockReq({ query: { search: 'guardia', page: '2', pageSize: '25' } }), res);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), [
      '%guardia%',
      25,
      25,
    ]);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [expect.not.objectContaining({ total_count: expect.anything() })],
      pagination: expect.objectContaining({
        page: 2,
        pageSize: 25,
        totalItems: 26,
        totalPages: 2,
      }),
    });
  });

  test('filtra por colaborador_id — usado por Personal para resolver el usuario de un colaborador', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 9, usuario: 'bruiz', colaborador_id: 2, total_count: 1 }],
    });
    const res = mockRes();

    await getUsuarios(mockReq({ query: { colaborador_id: '2' } }), res);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('u.colaborador_id = $1');
    expect(params).toEqual([2, 25, 0]);
  });

  test('rechaza colaborador_id inválido sin ejecutar query', async () => {
    const res = mockRes();

    await getUsuarios(mockReq({ query: { colaborador_id: 'abc' } }), res);

    expectStatus(res, 400);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('usuariosController.createUsuario', () => {
  test('rechaza crear Usuario sin colaborador', async () => {
    const res = mockRes();
    await createUsuario(
      mockReq({
        body: {
          usuario: 'sin_colaborador',
          nombre: 'Sin',
          apellido: 'Colaborador',
          tipo_usuario: 'secretario',
        },
      }),
      res
    );
    expectStatus(res, 400);
    expect(res.json.mock.calls[0][0].message).toMatch(/colaborador/i);
  });

  test.each([
    ['cero', []],
    ['uno', [4]],
    ['varios', [4, 5]],
  ])('crea Guardia con %s puntos', async (_label, ubicacionIds) => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 7, estado: 'activo', usuario_id: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            usuario: 'guardia',
            nombre: 'Guardia',
            apellido: 'Prueba',
            tipo_usuario: 'guardia',
            colaborador_id: 7,
            primer_login: true,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 4 }, { id: 5 }].slice(0, ubicacionIds.length),
        rowCount: ubicacionIds.length,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'guardia',
          nombre: 'Guardia',
          apellido: 'Prueba',
          tipo_usuario: 'guardia',
          colaborador_id: 7,
          ubicacion_ids: ubicacionIds,
        },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data.ubicacion_ids).toEqual(ubicacionIds);
  });

  test('crear usuario sin tocar asignaciones no exige permiso de asignaciones', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 7, estado: 'activo', usuario_id: null }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 2, usuario: 'nuevo', tipo_usuario: 'guardia', colaborador_id: 7 }],
        rowCount: 1,
      });
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'nuevo',
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: 'guardia',
          colaborador_id: 7,
        },
        user: { id: 9, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expectStatus(res, 201);
  });

  test.each([
    ['supervisor', 'secretario'],
    ['supervisor', 'supervisor'],
    ['supervisor', 'gerente'],
    ['secretario', 'gerente'],
  ])('%s no puede crear un usuario %s', async (actor, tipo) => {
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: { usuario: 'nuevo', tipo_usuario: tipo, colaborador_id: 7 },
        user: { id: 9, tipo_usuario: actor },
      }),
      res
    );

    expectStatus(res, 403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('secretario puede crear usuarios de cualquier rol excepto gerente', async () => {
    for (const tipo of ['secretario', 'supervisor', 'contador', 'guardia', 'monitorista']) {
      db.query.mockReset();
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 7, estado: 'activo', usuario_id: null }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ id: 2, tipo_usuario: tipo }], rowCount: 1 });
      const res = mockRes();

      await createUsuario(
        mockReq({
          body: { usuario: 'nuevo', tipo_usuario: tipo, colaborador_id: 7 },
          user: { id: 9, tipo_usuario: 'secretario' },
        }),
        res
      );

      expectStatus(res, 201);
    }
  });

  test('crea usuario con colaborador activo elegible', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 7, estado: 'activo', usuario_id: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            usuario: 'guardia_vinculado',
            nombre: 'Guardia',
            apellido: 'Vinculado',
            tipo_usuario: 'guardia',
            colaborador_id: 7,
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
          usuario: 'guardia_vinculado',
          nombre: 'Guardia',
          apellido: 'Vinculado',
          tipo_usuario: 'guardia',
          colaborador_id: 7,
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data.colaborador_id).toBe(7);
  });

  test.each([
    ['inexistente', { rows: [], rowCount: 0 }, 400, /no existe/i],
    [
      'inactivo',
      { rows: [{ id: 7, estado: 'inactivo', usuario_id: null }], rowCount: 1 },
      400,
      /inactivo/i,
    ],
    [
      'ya vinculado',
      { rows: [{ id: 7, estado: 'activo', usuario_id: 9 }], rowCount: 1 },
      409,
      /otro usuario/i,
    ],
  ])('rechaza colaborador %s al crear', async (_label, collaboratorResult, status, message) => {
    db.query.mockResolvedValueOnce(collaboratorResult);
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'guardia_vinculado',
          nombre: 'Guardia',
          apellido: 'Vinculado',
          tipo_usuario: 'guardia',
          colaborador_id: 7,
        },
      }),
      res
    );

    expectStatus(res, status);
    expect(res.json.mock.calls[0][0].message).toMatch(message);
  });

  test('convierte conflicto concurrente de colaborador en respuesta 409', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 7, estado: 'activo', usuario_id: null }],
        rowCount: 1,
      })
      .mockRejectedValueOnce({ code: '23505', constraint: 'usuarios_colaborador_id_key' });
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'guardia_conflicto',
          nombre: 'Guardia',
          apellido: 'Conflicto',
          tipo_usuario: 'guardia',
          colaborador_id: 7,
        },
      }),
      res
    );

    expectStatus(res, 409);
    expect(res.json.mock.calls[0][0].message).toMatch(/otro usuario/i);
  });

  test.each(['guardia', 'monitorista'])('acepta el nuevo rol %s', async (tipoUsuario) => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 7, estado: 'activo', usuario_id: null }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            usuario: `nuevo_${tipoUsuario}`,
            nombre: 'Nuevo',
            apellido: 'Usuario',
            tipo_usuario: tipoUsuario,
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
          usuario: `nuevo_${tipoUsuario}`,
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: tipoUsuario,
          colaborador_id: 7,
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data.tipo_usuario).toBe(tipoUsuario);
  });

  test('crea usuario válido con contraseña temporal', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 7, estado: 'activo', usuario_id: null }], rowCount: 1 })
      .mockResolvedValueOnce({
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
          colaborador_id: 7,
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ usuario: 'nuevo', temp_password: expect.any(String) })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.any(Function) }),
      expect.objectContaining({ tabla: 'usuarios' })
    );
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
          colaborador_id: 7,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/inválido/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('reporta usuario duplicado', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 7, estado: 'activo', usuario_id: null }], rowCount: 1 })
      .mockRejectedValueOnce({ code: '23505' });
    const res = mockRes();

    await createUsuario(
      mockReq({
        body: {
          usuario: 'nuevo',
          nombre: 'Nuevo',
          apellido: 'Usuario',
          tipo_usuario: 'secretario',
          colaborador_id: 7,
        },
      }),
      res
    );

    expectStatus(res, 409);
  });
});

describe('usuariosController.updateUsuario', () => {
  test('editar sin tocar asignaciones no exige permiso de asignaciones', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            nombre: 'Actualizado',
            tipo_usuario: 'secretario',
            activo: true,
            colaborador_id: 7,
          },
        ],
        rowCount: 1,
      });
    const res = mockRes();

    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { nombre: 'Actualizado' },
        user: { id: 9, tipo_usuario: 'secretario' },
      }),
      res
    );

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].data.colaborador_id).toBe(7);
  });

  test.each([
    ['nombre', { nombre: 'Actualizado' }],
    ['rol', { tipo_usuario: 'secretario' }],
    ['estado', { activo: false }],
    ['asignaciones', { ubicacion_ids: [4] }],
  ])('legacy sin colaborador rechaza editar %s sin vincularse', async (_label, body) => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: null }],
      rowCount: 1,
    });
    const res = mockRes();

    await updateUsuario(
      mockReq({ params: { id: '2' }, body, user: { id: 1, tipo_usuario: 'gerente' } }),
      res
    );

    expectStatus(res, 400);
    expect(res.json.mock.calls[0][0].message).toMatch(/colaborador/i);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('legacy sin colaborador edita y se vincula en la misma transacción', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true, colaborador_id: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 8, estado: 'activo', usuario_id: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            nombre: 'Actualizado',
            tipo_usuario: 'secretario',
            activo: true,
            colaborador_id: 8,
          },
        ],
        rowCount: 1,
      });
    const res = mockRes();

    await updateUsuario(
      mockReq({ params: { id: '2' }, body: { nombre: 'Actualizado', colaborador_id: 8 } }),
      res
    );

    expect(res.json.mock.calls[0][0].data.colaborador_id).toBe(8);
    expect(db.query.mock.calls[1][0]).toContain('FOR UPDATE OF c');
    expect(db.query.mock.calls[2][0]).toContain('UPDATE usuarios');
  });

  test.each([
    ['cero', []],
    ['uno', [4]],
    ['varios normalizando duplicados', [4, 5, 4]],
  ])('reemplaza asignaciones de Guardia con %s puntos', async (_label, ubicacionIds) => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 4 }, { id: 5 }].slice(0, new Set(ubicacionIds).size),
        rowCount: new Set(ubicacionIds).size,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    const res = mockRes();

    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { ubicacion_ids: ubicacionIds },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
      res
    );

    expect(res.json.mock.calls[0][0].data.ubicacion_ids).toEqual([...new Set(ubicacionIds)]);
  });

  test('rechaza ubicación inexistente y usuario no Guardia', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const missingRes = mockRes();
    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { ubicacion_ids: [99] },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
      missingRes
    );
    expectStatus(missingRes, 400);

    jest.clearAllMocks();
    db.transaction.mockImplementation(async (callback) => callback({ query: db.query }));
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 3, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 3, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      });
    const roleRes = mockRes();
    await updateUsuario(
      mockReq({
        params: { id: '3' },
        body: { ubicacion_ids: [4] },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
      roleRes
    );
    expectStatus(roleRes, 400);
  });

  test('secretario no puede editar un gerente ni asignar el rol gerente', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 2, tipo_usuario: 'gerente', activo: true, colaborador_id: 7 }],
      rowCount: 1,
    });
    const editGerente = mockRes();
    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { nombre: 'Otro' },
        user: { id: 9, tipo_usuario: 'secretario' },
      }),
      editGerente
    );
    expectStatus(editGerente, 403);

    db.query.mockResolvedValue({
      rows: [{ id: 3, tipo_usuario: 'guardia', activo: true, colaborador_id: 8 }],
      rowCount: 1,
    });
    const promote = mockRes();
    await updateUsuario(
      mockReq({
        params: { id: '3' },
        body: { tipo_usuario: 'gerente' },
        user: { id: 9, tipo_usuario: 'secretario' },
      }),
      promote
    );
    expectStatus(promote, 403);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('cambiar Guardia a otro rol retira todas las asignaciones', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    const res = mockRes();
    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { tipo_usuario: 'secretario' },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
      res
    );
    expect(
      db.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM usuario_ubicaciones'))
    ).toBe(true);
  });

  test('rollback de limpieza impide completar parcialmente el cambio de rol', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', activo: true }],
      rowCount: 1,
    });
    const transactionClient = { query: jest.fn() };
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockRejectedValueOnce(new Error('falló limpieza'));
    db.transaction.mockImplementation(async (callback) => callback(transactionClient));
    const res = mockRes();

    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { tipo_usuario: 'secretario' },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
      res
    );

    expect(transactionClient.query.mock.calls[0][0]).toContain('UPDATE usuarios');
    expect(transactionClient.query.mock.calls[1][0]).toContain('DELETE FROM usuario_ubicaciones');
    expectStatus(res, 500);
  });
  test('cambia el vínculo a otro colaborador activo elegible', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 8, estado: 'activo', usuario_id: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 8 }],
        rowCount: 1,
      });
    const res = mockRes();

    await updateUsuario(mockReq({ params: { id: '2' }, body: { colaborador_id: 8 } }), res);

    expect(res.json.mock.calls[0][0].data.colaborador_id).toBe(8);
    expect(db.query.mock.calls[1][0]).toContain('FOR UPDATE OF c');
    expect(db.query.mock.calls[2][1]).toEqual([8, 2]);
  });

  test.each([
    ['inexistente', { rows: [], rowCount: 0 }, 400, /no existe/i],
    [
      'inactivo',
      { rows: [{ id: 8, estado: 'inactivo', usuario_id: null }], rowCount: 1 },
      400,
      /inactivo/i,
    ],
    [
      'ya vinculado',
      { rows: [{ id: 8, estado: 'activo', usuario_id: 9 }], rowCount: 1 },
      409,
      /otro usuario/i,
    ],
  ])('rechaza colaborador %s al editar', async (_label, colaboradorResult, status, message) => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce(colaboradorResult);
    const res = mockRes();

    await updateUsuario(mockReq({ params: { id: '2' }, body: { colaborador_id: 8 } }), res);

    const body = expectStatus(res, status);
    expect(body.message).toMatch(message);
  });

  test('convierte conflicto concurrente durante edición en respuesta 409', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 8, estado: 'activo', usuario_id: null }],
        rowCount: 1,
      })
      .mockRejectedValueOnce({ code: '23505', constraint: 'usuarios_colaborador_id_key' });
    const res = mockRes();

    await updateUsuario(mockReq({ params: { id: '2' }, body: { colaborador_id: 8 } }), res);

    const body = expectStatus(res, 409);
    expect(body.message).toMatch(/otro usuario/i);
  });

  test('rechaza eliminar el colaborador durante edición', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
      rowCount: 1,
    });
    const res = mockRes();

    await updateUsuario(mockReq({ params: { id: '2' }, body: { colaborador_id: null } }), res);

    expectStatus(res, 400);
    expect(res.json.mock.calls[0][0].message).toMatch(/colaborador/i);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('conserva vínculo existente aunque el colaborador esté inactivo', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'guardia', activo: true, colaborador_id: 7 }],
        rowCount: 1,
      });
    const res = mockRes();

    await updateUsuario(mockReq({ params: { id: '2' }, body: { colaborador_id: 7 } }), res);

    expect(res.json.mock.calls[0][0].data.colaborador_id).toBe(7);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

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
      mockReq({
        params: { id: '2' },
        body: { tipo_usuario: 'secretario' },
        user: { id: 1, tipo_usuario: 'gerente' },
      }),
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
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.any(Function) }),
      expect.objectContaining({ operacion: 'UPDATE' })
    );
  });
});

describe('usuariosController.getColaboradoresElegibles', () => {
  test('retorna contrato mínimo sin datos bancarios o salariales', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 7,
          nombres_completos: 'Ana Vera',
          cedula: '123',
          cargo: 'Guardia',
          estado: 'activo',
        },
      ],
      rowCount: 1,
    });
    const res = mockRes();

    await getColaboradoresElegibles(mockReq({ query: {} }), res);

    expect(res.json.mock.calls[0][0].data[0]).toEqual({
      id: 7,
      nombres_completos: 'Ana Vera',
      cedula: '123',
      cargo: 'Guardia',
      estado: 'activo',
    });
    expect(db.query.mock.calls[0][0]).not.toMatch(/sueldo|banco|numero_cuenta/i);
  });

  test('excluye colaboradores vinculados a otros usuarios al crear', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = mockRes();

    await getColaboradoresElegibles(mockReq({ query: {} }), res);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/c\.estado = 'activo' AND u\.id IS NULL/);
    expect(params).toEqual([null]);
  });

  test('incluye como excepción únicamente el colaborador del usuario editado', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = mockRes();

    await getColaboradoresElegibles(mockReq({ query: { usuario_id: '12' } }), res);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/u\.id = \$1/);
    expect(sql).not.toMatch(/c\.estado = 'inactivo'/);
    expect(params).toEqual([12]);
  });
});

describe('usuariosController.getUbicacionesAsignables', () => {
  test('expone cliente, punto y dirección sin datos adicionales', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 4,
          nombre: 'Norte',
          direccion: 'Av. Amazonas',
          cliente_id: 2,
          cliente_nombre: 'Cliente A',
        },
      ],
      rowCount: 1,
    });
    const res = mockRes();
    await getUbicacionesAsignables(mockReq(), res);
    expect(res.json.mock.calls[0][0].data[0]).toEqual(
      expect.objectContaining({ direccion: 'Av. Amazonas', cliente_nombre: 'Cliente A' })
    );
    expect(db.query.mock.calls[0][0]).toMatch(/c\.direccion/);
  });
});

describe('usuariosController.reenviarInvitacion', () => {
  test('rechaza reenvío si el usuario ya completó primer acceso', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 2, usuario: 'activo', tipo_usuario: 'guardia', primer_login: false, activo: true },
      ],
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
    bitacoras_autor: 0,
    bitacoras_anuladas: 0,
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

  test('rechaza eliminar un usuario autor de Bitácoras', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ ...noActivity, bitacoras_autor: 1 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_HAS_ACTIVITY' }));
    expect(client.query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain(
      'DELETE FROM usuarios'
    );
  });

  test('rechaza eliminar un usuario anulador de Bitácoras', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 2, tipo_usuario: 'secretario', activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ ...noActivity, bitacoras_anuladas: 1 }], rowCount: 1 });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await deleteUsuario(mockReq({ params: { id: '2' }, user: { id: 1 } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_HAS_ACTIVITY' }));
    expect(client.query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toContain(
      'DELETE FROM usuarios'
    );
  });

  test('el diagnóstico consulta autoría y anulación de Bitácoras', async () => {
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

    const activitySql = String(client.query.mock.calls[1][0]);
    expect(activitySql).toContain('FROM bitacora_registros');
    expect(activitySql).toContain('autor_usuario_id = $1');
    expect(activitySql).toContain('anulado_por_usuario_id = $1');
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

describe('cuentas de módulo (usuarios sin colaborador)', () => {
  const accesos = { 'clientes.directorio': 'ver', 'inventario.articulos': 'editar' };
  const body = { usuario: 'modulo1', nombre: 'Módulo 1 Monitoreo', accesos };

  test('el esquema exige usuario, nombre y al menos un acceso', () => {
    expect(cuentaModuloCreateSchema.parse(body)).toEqual(body);
    expect(() => cuentaModuloCreateSchema.parse({ ...body, nombre: '' })).toThrow();
    expect(() => cuentaModuloCreateSchema.parse({ usuario: 'modulo1' })).toThrow();
    expect(() => cuentaModuloCreateSchema.parse({ ...body, accesos: {} })).toThrow();
    expect(() => cuentaModuloCreateSchema.parse({ ...body, accesos: { x: 'borrar' } })).toThrow();
  });

  test('el esquema de actualización acepta activo y/o accesos, pero no vacío', () => {
    expect(cuentaModuloUpdateSchema.parse({ activo: false })).toEqual({ activo: false });
    expect(cuentaModuloUpdateSchema.parse({ accesos })).toEqual({ accesos });
    expect(() => cuentaModuloUpdateSchema.parse({})).toThrow();
  });

  test('expandAccesos: ver solo consulta y editar suma las acciones', () => {
    const permisos = expandAccesos(accesos);
    expect(permisos).toContain(PERMISSIONS.CLIENTES_VER);
    expect(permisos).not.toContain(PERMISSIONS.CLIENTES_CREAR);
    expect(permisos).toEqual(
      expect.arrayContaining([
        PERMISSIONS.INVENTARIO_ARTICULOS_VER,
        PERMISSIONS.INVENTARIO_ARTICULOS_CREAR,
        PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR,
      ])
    );
  });

  test('una cuenta con permisos explícitos ignora los de su rol', () => {
    const cuenta = { tipo_usuario: 'monitorista', permisos: expandAccesos(accesos) };
    expect(hasPermission(cuenta, PERMISSIONS.INVENTARIO_ARTICULOS_CREAR)).toBe(true);
    expect(hasPermission(cuenta, PERMISSIONS.CLIENTES_ACCESO_PORTAL_CREAR)).toBe(false);
    expect(hasPermission(cuenta, PERMISSIONS.BITACORAS_HISTORIAL_VER)).toBe(false);
    expect(
      hasPermission({ tipo_usuario: 'monitorista' }, PERMISSIONS.BITACORAS_HISTORIAL_VER)
    ).toBe(true);
  });

  test('permisosDeUsuario solo aplica a cuentas compartidas con accesos', () => {
    expect(
      permisosDeUsuario({ es_cuenta_compartida: false, accesos_cuenta: accesos })
    ).toBeUndefined();
    expect(permisosDeUsuario({ es_cuenta_compartida: true, accesos_cuenta: null })).toBeUndefined();
    expect(permisosDeUsuario({ es_cuenta_compartida: true, accesos_cuenta: accesos })).toEqual(
      expandAccesos(accesos)
    );
  });

  test('validateAccesos rechaza tabs desconocidos, editar en solo consulta y exceso de permisos', () => {
    const todo = () => true;
    expect(validateAccesos(accesos, todo)).toBeNull();
    expect(validateAccesos({ 'personal.sueldos': 'ver' }, todo)).toMatch(/desconocido/);
    expect(validateAccesos({ 'bitacoras.visitas': 'editar' }, todo)).toBeNull();
    expect(validateAccesos(accesos, () => false)).toMatch(/No puedes conceder/);
  });

  test('crear rechaza conceder permisos que el creador no tiene', async () => {
    const res = mockRes();
    const req = mockReq({
      body,
      user: { id: 5, tipo_usuario: 'monitorista', activo: true },
    });

    await createCuentaModulo(req, res);

    expectStatus(res, 403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('actualizar cambia los accesos de la cuenta', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rows: [{ id: 9, tipo_usuario: 'monitorista', es_cuenta_compartida: true, activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 9, es_cuenta_compartida: true, accesos_cuenta: accesos }],
        rowCount: 1,
      });
    db.transaction.mockImplementationOnce(async (callback) => callback(client));
    const res = mockRes();

    await updateCuentaModulo(
      mockReq({ params: { id: '9' }, body: { accesos }, user: { id: 1, tipo_usuario: 'gerente' } }),
      res
    );

    expect(res.status).not.toHaveBeenCalledWith(403);
    const updateCall = client.query.mock.calls.find(([sql]) => /UPDATE usuarios/.test(sql));
    expect(updateCall[1]).toEqual([null, JSON.stringify(accesos), 9]);
  });

  test('crea una monitorista compartida sin colaborador', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 9, ...body, apellido: null, tipo_usuario: 'monitorista', es_cuenta_compartida: true },
      ],
      rowCount: 1,
    });
    const res = mockRes();

    await createCuentaModulo(mockReq({ body }), res);

    const payload = expectStatus(res, 201);
    expect(payload.data.temp_password).toEqual(expect.any(String));
    expect(db.query.mock.calls[0][0]).toContain('es_cuenta_compartida');
    expect(db.query.mock.calls[0][1]).toEqual([
      'modulo1',
      'hashed-temp-password',
      'Módulo 1 Monitoreo',
      'monitorista',
      JSON.stringify(accesos),
    ]);
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operacion: 'INSERT' })
    );
  });

  test.each(['gerente', 'secretario', 'supervisor', 'monitorista'])(
    '%s puede ver y gestionar cuentas de módulo',
    (rol) => {
      expect(hasPermission(rol, PERMISSIONS.USUARIOS_CUENTAS_MODULO_VER)).toBe(true);
      expect(hasPermission(rol, PERMISSIONS.USUARIOS_CUENTAS_MODULO_GESTIONAR)).toBe(true);
    }
  );

  test.each(['guardia', 'contador', 'cliente'])('%s no tiene acceso a cuentas de módulo', (rol) => {
    expect(hasPermission(rol, PERMISSIONS.USUARIOS_CUENTAS_MODULO_VER)).toBe(false);
    expect(hasPermission(rol, PERMISSIONS.USUARIOS_CUENTAS_MODULO_GESTIONAR)).toBe(false);
  });

  test('el jefe de monitoreo consulta Clientes y solo crea ubicaciones y accesos de portal', () => {
    const can = (permission) => hasPermission('monitorista', permission);
    expect(can(PERMISSIONS.CLIENTES_VER)).toBe(true);
    expect(can(PERMISSIONS.INVENTARIO_UBICACIONES_VER)).toBe(true);
    expect(can(PERMISSIONS.INVENTARIO_UBICACIONES_CREAR)).toBe(true);
    expect(can(PERMISSIONS.CLIENTES_ACCESO_PORTAL_CREAR)).toBe(true);
    // No crea, edita ni elimina clientes; no edita, reasigna ni elimina ubicaciones.
    [
      PERMISSIONS.CLIENTES_CREAR,
      PERMISSIONS.CLIENTES_EDITAR,
      PERMISSIONS.CLIENTES_ELIMINAR,
      PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR,
      PERMISSIONS.INVENTARIO_UBICACIONES_REASIGNAR_CLIENTE,
      PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR,
      PERMISSIONS.CLIENTES_ACCESO_PORTAL_ADMINISTRAR,
    ].forEach((permission) => expect(can(permission)).toBe(false));
  });

  test('monitorista y supervisor no ven sueldos ni administran otros usuarios', () => {
    expect(hasPermission('monitorista', PERMISSIONS.PERSONAL_VER)).toBe(false);
    expect(hasPermission('monitorista', PERMISSIONS.USUARIOS_CREAR)).toBe(false);
    expect(hasPermission('supervisor', PERMISSIONS.USUARIOS_EDITAR)).toBe(false);
  });

  test('desactivar una cuenta de módulo la actualiza y audita', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 9, tipo_usuario: 'monitorista', es_cuenta_compartida: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 9, activo: false }], rowCount: 1 });
    const res = mockRes();
    await updateCuentaModulo(
      mockReq({
        params: { id: '9' },
        body: { activo: false },
        user: { id: 3, tipo_usuario: 'monitorista' },
      }),
      res
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(logAudit).toHaveBeenCalled();
  });

  test('no se puede usar el endpoint con un usuario que no es cuenta de módulo', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', es_cuenta_compartida: false }],
      rowCount: 1,
    });
    const res = mockRes();
    await updateCuentaModulo(mockReq({ params: { id: '2' }, body: { activo: false } }), res);
    expectStatus(res, 404);
  });

  test('no puedes desactivar tu propia cuenta', async () => {
    const res = mockRes();
    await updateCuentaModulo(
      mockReq({
        params: { id: '9' },
        body: { activo: false },
        user: { id: 9, tipo_usuario: 'monitorista' },
      }),
      res
    );
    expectStatus(res, 400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('lista solo cuentas de módulo', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 9, total_count: 1 }], rowCount: 1 });
    const res = mockRes();
    await getCuentasModulo(mockReq(), res);
    expect(db.query.mock.calls[0][0]).toContain('u.es_cuenta_compartida = TRUE');
    expect(res.json.mock.calls[0][0].data).toEqual([{ id: 9 }]);
  });

  test('no reenvía la invitación de una cuenta de módulo que ya inició sesión', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 9, tipo_usuario: 'monitorista', es_cuenta_compartida: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            tipo_usuario: 'monitorista',
            primer_login: false,
            activo: true,
            es_cuenta_compartida: true,
          },
        ],
        rowCount: 1,
      });
    const res = mockRes();
    await reenviarInvitacionCuentaModulo(
      mockReq({ params: { id: '9' }, user: { id: 3, tipo_usuario: 'monitorista' } }),
      res
    );
    expectStatus(res, 400);
  });

  test('un usuario normal ya activo sigue sin poder reenviar invitación', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', primer_login: false, es_cuenta_compartida: false }],
      rowCount: 1,
    });
    const res = mockRes();
    await reenviarInvitacion(mockReq({ params: { id: '2' } }), res);
    expectStatus(res, 400);
  });

  test('reenviar invitación exige que sea cuenta de módulo', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', es_cuenta_compartida: false }],
      rowCount: 1,
    });
    const res = mockRes();
    await reenviarInvitacionCuentaModulo(mockReq({ params: { id: '2' } }), res);
    expectStatus(res, 404);
  });

  test('reporta usuario duplicado', async () => {
    db.query.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    const res = mockRes();
    await createCuentaModulo(mockReq({ body }), res);
    expectStatus(res, 409);
  });

  test('se puede desactivar sin colaborador, pero no cambiar rol ni vincular colaborador', async () => {
    const summary = {
      id: 9,
      tipo_usuario: 'monitorista',
      activo: true,
      colaborador_id: null,
      es_cuenta_compartida: true,
    };
    db.query
      .mockResolvedValueOnce({ rows: [summary], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 9, activo: false }], rowCount: 1 });
    const ok = mockRes();
    await updateUsuario(mockReq({ params: { id: '9' }, body: { activo: false } }), ok);
    expect(ok.json.mock.calls[0][0].success).toBe(true);

    db.query.mockResolvedValueOnce({ rows: [summary], rowCount: 1 });
    const bad = mockRes();
    await updateUsuario(mockReq({ params: { id: '9' }, body: { colaborador_id: 4 } }), bad);
    expectStatus(bad, 400);
  });

  test('getUsuarios filtra por cuenta_compartida', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();
    await getUsuarios(mockReq({ query: { cuenta_compartida: 'true' } }), res);
    expect(db.query.mock.calls[0][0]).toContain('u.es_cuenta_compartida = TRUE');
  });
});
