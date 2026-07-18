export const INVENTORY_ACTIONS = {
  ARTICULOS_VIEW: 'articulos.view',
  ARTICULOS_CREATE: 'articulos.create',
  ARTICULOS_EDIT: 'articulos.edit',
  ARTICULOS_BAJA: 'articulos.baja',
  ARTICULOS_DELETE_ADMIN: 'articulos.deleteAdmin',
  MOVIMIENTOS_VIEW: 'movimientos.view',
  MOVIMIENTOS_CREATE: 'movimientos.create',
  MOVIMIENTOS_VOID: 'movimientos.void',
  MOVIMIENTOS_DELETE_ADMIN: 'movimientos.deleteAdmin',
  MOVIMIENTOS_PDF_DOWNLOAD: 'movimientos.pdf.download',
  MOVIMIENTOS_PDF_REGENERATE: 'movimientos.pdf.regenerate',
  BAJAS_VIEW: 'bajas.view',
  BAJAS_CREATE: 'bajas.create',
  BAJAS_VOID: 'bajas.void',
  BAJAS_DELETE_ADMIN: 'bajas.deleteAdmin',
  REPORTS_EXPORT: 'reports.export',
};

const ROLE_ACTIONS = {
  gerente: Object.values(INVENTORY_ACTIONS),
  supervisor: [
    INVENTORY_ACTIONS.ARTICULOS_VIEW,
    INVENTORY_ACTIONS.ARTICULOS_CREATE,
    INVENTORY_ACTIONS.ARTICULOS_EDIT,
    INVENTORY_ACTIONS.ARTICULOS_BAJA,
    INVENTORY_ACTIONS.MOVIMIENTOS_VIEW,
    INVENTORY_ACTIONS.MOVIMIENTOS_CREATE,
    INVENTORY_ACTIONS.MOVIMIENTOS_VOID,
    INVENTORY_ACTIONS.MOVIMIENTOS_PDF_DOWNLOAD,
    INVENTORY_ACTIONS.BAJAS_VIEW,
    INVENTORY_ACTIONS.BAJAS_CREATE,
    INVENTORY_ACTIONS.BAJAS_VOID,
    INVENTORY_ACTIONS.REPORTS_EXPORT,
  ],
  secretario: [
    INVENTORY_ACTIONS.ARTICULOS_VIEW,
    INVENTORY_ACTIONS.MOVIMIENTOS_VIEW,
    INVENTORY_ACTIONS.MOVIMIENTOS_CREATE,
    INVENTORY_ACTIONS.MOVIMIENTOS_PDF_DOWNLOAD,
    INVENTORY_ACTIONS.BAJAS_VIEW,
    INVENTORY_ACTIONS.REPORTS_EXPORT,
  ],
  contador: [],
};

export const getInventoryPermissions = (user) => {
  const role = user?.tipo_usuario;
  const allowedActions = new Set(ROLE_ACTIONS[role] || []);
  return {
    role,
    canAccessInventory: allowedActions.size > 0,
    can: (action) => allowedActions.has(action),
  };
};

export const hasInventoryAction = (user, action) => getInventoryPermissions(user).can(action);
