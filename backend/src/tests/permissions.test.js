/**
 * Tests para middlewares de autorización
 *
 * Cubre:
 * - requirePermission: acceso correcto por rol
 * - requireRole: restricción a rol específico
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../config/logger', () => ({
  error: jest.fn(),
}));

const db = require('../config/database');
const {
  requirePermission,
  requireRole,
  requireActive,
  clearActiveCache,
} = require('../middleware/permissions');

const mockReq = (tipo_usuario) => ({
  user: { id: 1, usuario: 'test', tipo_usuario },
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
  clearActiveCache();
});

// ============================================
// requirePermission
// ============================================

describe('requirePermission', () => {
  test('gerente accede al módulo cuentas', () => {
    const middleware = requirePermission('cuentas');
    middleware(mockReq('gerente'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('contador accede al módulo cuentas', () => {
    const middleware = requirePermission('cuentas');
    middleware(mockReq('contador'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('supervisor NO accede al módulo cuentas', () => {
    const middleware = requirePermission('cuentas');
    const res = mockRes();
    middleware(mockReq('supervisor'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('supervisor accede al módulo inventario', () => {
    const middleware = requirePermission('inventario');
    middleware(mockReq('supervisor'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('supervisor puede crear artículo', () => {
    const middleware = requirePermission('crear_articulo');
    middleware(mockReq('supervisor'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('supervisor NO puede eliminar artículo', () => {
    const middleware = requirePermission('eliminar_articulo');
    const res = mockRes();
    middleware(mockReq('supervisor'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('supervisor puede dar de baja artículo', () => {
    const middleware = requirePermission('dar_baja_articulo');
    middleware(mockReq('supervisor'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('contador NO puede crear artículo', () => {
    const middleware = requirePermission('crear_articulo');
    const res = mockRes();
    middleware(mockReq('contador'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('gerente accede al módulo usuarios', () => {
    const middleware = requirePermission('usuarios');
    middleware(mockReq('gerente'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('secretario NO accede al módulo usuarios', () => {
    const middleware = requirePermission('usuarios');
    const res = mockRes();
    middleware(mockReq('secretario'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================
// requireRole
// ============================================

describe('requireRole', () => {
  test('gerente pasa el filtro requireRole("gerente")', () => {
    const middleware = requireRole('gerente');
    middleware(mockReq('gerente'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('secretario NO pasa requireRole("gerente")', () => {
    const middleware = requireRole('gerente');
    const res = mockRes();
    middleware(mockReq('secretario'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('acepta múltiples roles: secretario pasa requireRole("gerente", "secretario")', () => {
    const middleware = requireRole('gerente', 'secretario');
    middleware(mockReq('secretario'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('supervisor NO pasa requireRole("gerente", "secretario")', () => {
    const middleware = requireRole('gerente', 'secretario');
    const res = mockRes();
    middleware(mockReq('supervisor'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ============================================
// requireActive
// ============================================

describe('requireActive', () => {
  test('rechaza request sin usuario autenticado', async () => {
    const res = mockRes();
    await requireActive({ user: null }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('permite usuario activo', async () => {
    db.query.mockResolvedValue({ rows: [{ activo: true }], rowCount: 1 });

    await requireActive(mockReq('gerente'), mockRes(), next);

    expect(db.query).toHaveBeenCalledWith('SELECT activo FROM usuarios WHERE id = $1', [1]);
    expect(next).toHaveBeenCalled();
  });

  test('rechaza usuario inexistente', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = mockRes();

    await requireActive(mockReq('gerente'), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza usuario inactivo', async () => {
    db.query.mockResolvedValue({ rows: [{ activo: false }], rowCount: 1 });
    const res = mockRes();

    await requireActive(mockReq('gerente'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
