const { PERMISSIONS, hasPermission } = require('../config/permissions');
const {
  requirePermission,
  requireAnyPermission,
  assertPermission,
  assertAnyPermission,
  requireRole,
  requireActive,
} = require('../middleware/permissions');
const { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } = require('../utils/authErrorCodes');

const mockReq = (tipo_usuario, extraUser = {}) => ({
  user: { id: 1, usuario: 'test', tipo_usuario, activo: true, ...extraUser },
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const next = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('permission matrix', () => {
  test('gerente es superadmin para cualquier permiso definido', () => {
    expect(hasPermission('gerente', PERMISSIONS.USUARIOS_ELIMINAR)).toBe(true);
    expect(hasPermission('gerente', PERMISSIONS.INVENTARIO_MOVIMIENTOS_REGENERAR_PDF)).toBe(true);
    expect(hasPermission('gerente', PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR)).toBe(true);
  });

  test('permiso desconocido no concede acceso ni siquiera a gerente', () => {
    expect(hasPermission('gerente', 'inventario.ubicaciones.publicar')).toBe(false);
    expect(hasPermission('supervisor', 'inventario.ubicaciones.publicar')).toBe(false);
  });

  test('secretario puede crear clientes pero no facturas ni abonos', () => {
    expect(hasPermission('secretario', PERMISSIONS.CUENTAS_CLIENTES_CREAR)).toBe(true);
    expect(hasPermission('secretario', PERMISSIONS.CUENTAS_FACTURAS_CREAR)).toBe(false);
    expect(hasPermission('secretario', PERMISSIONS.CUENTAS_ABONOS_CREAR)).toBe(false);
  });

  test('contador puede operar Cuentas y solo ver Personal', () => {
    expect(hasPermission('contador', PERMISSIONS.CUENTAS_FACTURAS_CREAR)).toBe(true);
    expect(hasPermission('contador', PERMISSIONS.CUENTAS_ABONOS_ELIMINAR)).toBe(true);
    expect(hasPermission('contador', PERMISSIONS.CUENTAS_FACTURAS_CANCELAR)).toBe(false);
    expect(hasPermission('contador', PERMISSIONS.CUENTAS_PAGOS_ANULAR)).toBe(false);
    expect(hasPermission('gerente', PERMISSIONS.CUENTAS_PAGOS_ANULAR)).toBe(true);
    expect(hasPermission('contador', PERMISSIONS.PERSONAL_VER)).toBe(true);
    expect(hasPermission('contador', PERMISSIONS.PERSONAL_CREAR)).toBe(false);
  });

  test('supervisor puede operar inventario sin eliminar ni regenerar PDF', () => {
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_ARTICULOS_CREAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_ARTICULOS_DAR_BAJA)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_ARTICULOS_ELIMINAR)).toBe(false);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_UBICACIONES_VER)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_UBICACIONES_CREAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR)).toBe(false);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_MOVIMIENTOS_ANULAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_BAJAS_ANULAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_MOVIMIENTOS_REGENERAR_PDF)).toBe(
      false
    );
  });

  test('solo gerente puede eliminar administrativamente inventario', () => {
    expect(hasPermission('gerente', PERMISSIONS.INVENTARIO_MOVIMIENTOS_ELIMINAR)).toBe(true);
    expect(hasPermission('gerente', PERMISSIONS.INVENTARIO_BAJAS_ELIMINAR)).toBe(true);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_MOVIMIENTOS_ELIMINAR)).toBe(false);
    expect(hasPermission('supervisor', PERMISSIONS.INVENTARIO_BAJAS_ELIMINAR)).toBe(false);
  });

  test('catálogo de clientes queda restringido a gerente en esta fase', () => {
    expect(hasPermission('gerente', PERMISSIONS.CLIENTES_VER)).toBe(true);
    expect(hasPermission('gerente', PERMISSIONS.CLIENTES_CREAR)).toBe(true);
    expect(hasPermission('secretario', PERMISSIONS.CLIENTES_CREAR)).toBe(false);
    expect(hasPermission('contador', PERMISSIONS.CLIENTES_EDITAR)).toBe(false);
    expect(hasPermission('supervisor', PERMISSIONS.CLIENTES_ELIMINAR)).toBe(false);
  });

  test('secretario conserva solo lectura de ubicaciones durante transición', () => {
    expect(hasPermission('secretario', PERMISSIONS.INVENTARIO_UBICACIONES_VER)).toBe(true);
    expect(hasPermission('secretario', PERMISSIONS.INVENTARIO_UBICACIONES_CREAR)).toBe(false);
    expect(hasPermission('secretario', PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR)).toBe(false);
    expect(hasPermission('secretario', PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR)).toBe(false);
  });

  test('contador sigue sin permisos de ubicaciones', () => {
    expect(hasPermission('contador', PERMISSIONS.INVENTARIO_UBICACIONES_VER)).toBe(false);
    expect(hasPermission('contador', PERMISSIONS.INVENTARIO_UBICACIONES_CREAR)).toBe(false);
    expect(hasPermission('contador', PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR)).toBe(false);
    expect(hasPermission('contador', PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR)).toBe(false);
  });
});

describe('requirePermission', () => {
  test('permite acción concedida por rol actual', () => {
    const middleware = requirePermission(PERMISSIONS.PERSONAL_CREAR);

    middleware(mockReq('supervisor'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('rechaza acción no concedida sin exponer matriz interna', () => {
    const middleware = requirePermission(PERMISSIONS.USUARIOS_VER);
    const res = mockRes();

    middleware(mockReq('secretario'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS],
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/USUARIOS_VER|secretario|stack/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza usuario ausente con contrato de autenticación', () => {
    const middleware = requirePermission(PERMISSIONS.PERSONAL_CREAR);
    const res = mockRes();

    middleware({ user: null }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza permiso ausente o desconocido de forma segura', () => {
    const missingPermission = requirePermission();
    const unknownPermission = requirePermission('inventario.ubicaciones.publicar');
    const missingRes = mockRes();
    const unknownRes = mockRes();

    missingPermission(mockReq('gerente'), missingRes, next);
    unknownPermission(mockReq('gerente'), unknownRes, next);

    expect(missingRes.status).toHaveBeenCalledWith(403);
    expect(unknownRes.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('no depende de una propiedad permisos en el usuario', () => {
    const middleware = requirePermission(PERMISSIONS.PERSONAL_CREAR);

    middleware(mockReq('supervisor', { permisos: undefined }), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('requireAnyPermission', () => {
  test('permite el primer permiso concedido', () => {
    const middleware = requireAnyPermission(
      PERMISSIONS.INVENTARIO_UBICACIONES_VER,
      PERMISSIONS.USUARIOS_VER
    );

    middleware(mockReq('secretario'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('permite el segundo permiso concedido', () => {
    const middleware = requireAnyPermission(
      PERMISSIONS.USUARIOS_VER,
      PERMISSIONS.INVENTARIO_UBICACIONES_VER
    );

    middleware(mockReq('secretario'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('permite cuando tiene ambos permisos', () => {
    const middleware = requireAnyPermission(
      PERMISSIONS.INVENTARIO_UBICACIONES_VER,
      PERMISSIONS.INVENTARIO_ARTICULOS_VER
    );

    middleware(mockReq('secretario'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('rechaza cuando no tiene ninguno y mantiene código de permisos', () => {
    const middleware = requireAnyPermission(
      PERMISSIONS.INVENTARIO_UBICACIONES_VER,
      PERMISSIONS.INVENTARIO_ARTICULOS_VER
    );
    const res = mockRes();

    middleware(mockReq('contador'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('mantiene superadmin', () => {
    const middleware = requireAnyPermission('permiso.inexistente', PERMISSIONS.USUARIOS_VER);

    middleware(mockReq('gerente'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('acepta una colección sin mutarla', () => {
    const permissions = [PERMISSIONS.USUARIOS_VER, PERMISSIONS.INVENTARIO_UBICACIONES_VER];
    const original = [...permissions];
    const middleware = requireAnyPermission(permissions);

    middleware(mockReq('secretario'), mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(permissions).toEqual(original);
  });

  test('rechaza lista vacía de permisos', () => {
    const middleware = requireAnyPermission();
    const res = mockRes();

    middleware(mockReq('gerente'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza lista con valores inválidos sin otorgar acceso', () => {
    const middleware = requireAnyPermission('', null, undefined, false, 123, {});
    const res = mockRes();

    middleware(mockReq('gerente'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(next).not.toHaveBeenCalled();
  });

  test('no autoriza por coincidencias parciales de strings', () => {
    const middleware = requireAnyPermission('inventario.ubicaciones');
    const res = mockRes();

    middleware(mockReq('supervisor'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('permite permisos duplicados cuando el permiso exacto está concedido', () => {
    const middleware = requireAnyPermission(
      PERMISSIONS.INVENTARIO_UBICACIONES_VER,
      PERMISSIONS.INVENTARIO_UBICACIONES_VER
    );

    middleware(mockReq('secretario'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('rechaza usuario sin tipo aunque tenga id activo', () => {
    const middleware = requireAnyPermission(PERMISSIONS.INVENTARIO_UBICACIONES_VER);
    const res = mockRes();

    middleware(mockReq(undefined), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza usuario inactivo con flujo existente', () => {
    const middleware = requireAnyPermission(PERMISSIONS.INVENTARIO_UBICACIONES_VER);
    const res = mockRes();

    middleware(mockReq('secretario', { activo: false }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.USER_DISABLED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_DISABLED],
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('assertPermission', () => {
  test('permite permiso individual concedido', () => {
    expect(() =>
      assertPermission(mockReq('supervisor').user, PERMISSIONS.INVENTARIO_UBICACIONES_CREAR)
    ).not.toThrow();
  });

  test('lanza error de autorización reutilizable con permiso individual denegado', () => {
    try {
      assertPermission(mockReq('contador').user, PERMISSIONS.INVENTARIO_UBICACIONES_VER);
    } catch (error) {
      expect(error.status).toBe(403);
      expect(error.statusCode).toBe(403);
      expect(error.appCode).toBe(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(error.message).toBe(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]);
      return;
    }

    throw new Error('assertPermission debió lanzar error');
  });

  test('lanza 401 cuando no recibe usuario autenticado', () => {
    try {
      assertPermission(null, PERMISSIONS.INVENTARIO_UBICACIONES_VER);
    } catch (error) {
      expect(error.status).toBe(401);
      expect(error.appCode).toBe(AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED);
      return;
    }

    throw new Error('assertPermission debió lanzar error');
  });

  test('rechaza permiso desconocido para gerente', () => {
    expect(() =>
      assertPermission(mockReq('gerente').user, 'inventario.ubicaciones.publicar')
    ).toThrow(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]);
  });
});

describe('assertAnyPermission', () => {
  test('permite ramas condicionales cuando algún permiso está concedido', () => {
    expect(() =>
      assertAnyPermission(
        mockReq('secretario').user,
        PERMISSIONS.USUARIOS_VER,
        PERMISSIONS.INVENTARIO_UBICACIONES_VER
      )
    ).not.toThrow();
  });

  test('lanza error 403 reutilizable por controladores cuando no tiene permisos', () => {
    expect(() =>
      assertAnyPermission(
        mockReq('contador').user,
        PERMISSIONS.INVENTARIO_UBICACIONES_VER,
        PERMISSIONS.INVENTARIO_ARTICULOS_VER
      )
    ).toThrow(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]);

    try {
      assertAnyPermission(
        mockReq('contador').user,
        PERMISSIONS.INVENTARIO_UBICACIONES_VER,
        PERMISSIONS.INVENTARIO_ARTICULOS_VER
      );
    } catch (error) {
      expect(error.status).toBe(403);
      expect(error.appCode).toBe(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }
  });

  test('conserva la regla de usuario inactivo', () => {
    try {
      assertAnyPermission(
        mockReq('secretario', { activo: false }).user,
        PERMISSIONS.INVENTARIO_UBICACIONES_VER
      );
    } catch (error) {
      expect(error.status).toBe(403);
      expect(error.appCode).toBe(AUTH_ERROR_CODES.USER_DISABLED);
    }
  });

  test('acepta colección de permisos y permite cuando uno coincide', () => {
    expect(() =>
      assertAnyPermission(mockReq('secretario').user, [
        PERMISSIONS.USUARIOS_VER,
        PERMISSIONS.INVENTARIO_UBICACIONES_VER,
      ])
    ).not.toThrow();
  });

  test('rechaza colección vacía o inválida', () => {
    expect(() => assertAnyPermission(mockReq('gerente').user)).toThrow(
      AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]
    );
    expect(() => assertAnyPermission(mockReq('gerente').user, '', null, 123)).toThrow(
      AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]
    );
  });
});

describe('requireRole', () => {
  test('usa el rol actual ya rehidratado en req.user', () => {
    const middleware = requireRole('gerente');

    middleware(mockReq('gerente'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('rechaza rol no permitido', () => {
    const middleware = requireRole('gerente');
    const res = mockRes();

    middleware(mockReq('secretario'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS],
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireActive', () => {
  test('rechaza request sin usuario autenticado', () => {
    const res = mockRes();

    requireActive({ user: null }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('permite usuario activo ya rehidratado', () => {
    requireActive(mockReq('gerente'), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  test('rechaza usuario inactivo ya rehidratado', () => {
    const res = mockRes();

    requireActive(mockReq('gerente', { activo: false }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      code: AUTH_ERROR_CODES.USER_DISABLED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_DISABLED],
    });
    expect(next).not.toHaveBeenCalled();
  });
});
