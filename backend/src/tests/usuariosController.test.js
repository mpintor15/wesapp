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
const { usuarioCreateSchema, usuarioUpdateSchema } = require('../utils/validationSchemas');
const {
  createUsuario,
  getUsuarios,
  getColaboradoresElegibles,
  getUsuariosSinColaborador,
  getUbicacionesAsignables,
  updateUsuario,
  reenviarInvitacion,
  deleteUsuario,
} = require('../controllers/usuariosController');

const mockReq = ({ body = {}, params = {}, query = {}, user = { id: 1 } } = {}) => ({
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
        rows: [{ id: 2, usuario: 'nuevo', tipo_usuario: 'secretario', colaborador_id: 7 }],
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
        user: { id: 9, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expectStatus(res, 201);
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
        user: { id: 9, tipo_usuario: 'supervisor' },
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

  test('rechaza modificar asignaciones sin permiso', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 2, tipo_usuario: 'guardia', activo: true }],
      rowCount: 1,
    });
    const res = mockRes();
    await updateUsuario(
      mockReq({
        params: { id: '2' },
        body: { ubicacion_ids: [4] },
        user: { id: 9, tipo_usuario: 'supervisor' },
      }),
      res
    );
    expectStatus(res, 403);
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

describe('usuariosController.getUsuariosSinColaborador', () => {
  test('lista usuarios legacy sin colaborador vinculado', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 4,
          usuario: 'HPinto',
          nombre: 'Holger',
          apellido: 'Pinto',
          tipo_usuario: 'gerente',
          activo: true,
        },
      ],
      rowCount: 1,
    });
    const res = mockRes();

    await getUsuariosSinColaborador(mockReq({ query: {} }), res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          id: 4,
          usuario: 'HPinto',
          nombre: 'Holger',
          apellido: 'Pinto',
          tipo_usuario: 'gerente',
          activo: true,
        },
      ],
    });
    expect(db.query.mock.calls[0][0]).toMatch(/colaborador_id IS NULL/);
    expect(db.query.mock.calls[0][0]).not.toMatch(/password_hash/i);
  });

  test('responde 500 controlado si la consulta falla', async () => {
    db.query.mockRejectedValue(new Error('boom'));
    const res = mockRes();

    await getUsuariosSinColaborador(mockReq({ query: {} }), res);

    expect(res.status).toHaveBeenCalledWith(500);
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
