const { PERMISSIONS, hasPermission } = require('../config/permissions');
const { requirePermission, requireRole, requireActive } = require('../middleware/permissions');
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
