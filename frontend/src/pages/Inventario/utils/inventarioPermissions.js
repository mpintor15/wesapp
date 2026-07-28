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
  LOCATIONS_CREATE_FROM_ARTICLE: 'locations.createFromArticle',
  LOCATIONS_CREATE_FROM_MOVEMENT: 'locations.createFromMovement',
};

export const INVENTORY_RAW_PERMISSIONS = {
  ARTICULOS_VIEW: 'inventario.articulos.ver',
  ARTICULOS_CREATE: 'inventario.articulos.crear',
  ARTICULOS_EDIT: 'inventario.articulos.editar',
  ARTICULOS_BAJA: 'inventario.articulos.dar_baja',
  ARTICULOS_DELETE_ADMIN: 'inventario.articulos.eliminar',
  UBICACIONES_CREATE: 'inventario.ubicaciones.crear',
  MOVIMIENTOS_VIEW: 'inventario.movimientos.ver',
  MOVIMIENTOS_CREATE: 'inventario.movimientos.crear',
  MOVIMIENTOS_VOID: 'inventario.movimientos.anular',
  MOVIMIENTOS_DELETE_ADMIN: 'inventario.movimientos.eliminar',
  MOVIMIENTOS_PDF_REGENERATE: 'inventario.movimientos.regenerar_pdf',
  BAJAS_VIEW: 'inventario.bajas.ver',
  BAJAS_CREATE: 'inventario.bajas.crear',
  BAJAS_VOID: 'inventario.bajas.anular',
  BAJAS_DELETE_ADMIN: 'inventario.bajas.eliminar',
  REPORTS_EXPORT: 'inventario.reportes.exportar',
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
    INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_ARTICLE,
    INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_MOVEMENT,
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

const RAW_ACTION_MAP = {
  [INVENTORY_RAW_PERMISSIONS.ARTICULOS_VIEW]: INVENTORY_ACTIONS.ARTICULOS_VIEW,
  [INVENTORY_RAW_PERMISSIONS.ARTICULOS_CREATE]: INVENTORY_ACTIONS.ARTICULOS_CREATE,
  [INVENTORY_RAW_PERMISSIONS.ARTICULOS_EDIT]: INVENTORY_ACTIONS.ARTICULOS_EDIT,
  [INVENTORY_RAW_PERMISSIONS.ARTICULOS_BAJA]: INVENTORY_ACTIONS.ARTICULOS_BAJA,
  [INVENTORY_RAW_PERMISSIONS.ARTICULOS_DELETE_ADMIN]: INVENTORY_ACTIONS.ARTICULOS_DELETE_ADMIN,
  [INVENTORY_RAW_PERMISSIONS.MOVIMIENTOS_VIEW]: INVENTORY_ACTIONS.MOVIMIENTOS_VIEW,
  [INVENTORY_RAW_PERMISSIONS.MOVIMIENTOS_CREATE]: INVENTORY_ACTIONS.MOVIMIENTOS_CREATE,
  [INVENTORY_RAW_PERMISSIONS.MOVIMIENTOS_VOID]: INVENTORY_ACTIONS.MOVIMIENTOS_VOID,
  [INVENTORY_RAW_PERMISSIONS.MOVIMIENTOS_DELETE_ADMIN]: INVENTORY_ACTIONS.MOVIMIENTOS_DELETE_ADMIN,
  [INVENTORY_RAW_PERMISSIONS.MOVIMIENTOS_PDF_REGENERATE]:
    INVENTORY_ACTIONS.MOVIMIENTOS_PDF_REGENERATE,
  [INVENTORY_RAW_PERMISSIONS.BAJAS_VIEW]: INVENTORY_ACTIONS.BAJAS_VIEW,
  [INVENTORY_RAW_PERMISSIONS.BAJAS_CREATE]: INVENTORY_ACTIONS.BAJAS_CREATE,
  [INVENTORY_RAW_PERMISSIONS.BAJAS_VOID]: INVENTORY_ACTIONS.BAJAS_VOID,
  [INVENTORY_RAW_PERMISSIONS.BAJAS_DELETE_ADMIN]: INVENTORY_ACTIONS.BAJAS_DELETE_ADMIN,
  [INVENTORY_RAW_PERMISSIONS.REPORTS_EXPORT]: INVENTORY_ACTIONS.REPORTS_EXPORT,
};

const getExplicitPermissions = (user) => {
  const permissions = user?.permisos || user?.permissions;
  return Array.isArray(permissions) ? permissions : null;
};

const applyRawPermissionMappings = (allowedActions, explicitPermissions) => {
  if (!explicitPermissions) return;
  explicitPermissions.forEach((permission) => {
    if (Object.values(INVENTORY_ACTIONS).includes(permission)) {
      allowedActions.add(permission);
    }
    if (RAW_ACTION_MAP[permission]) {
      allowedActions.add(RAW_ACTION_MAP[permission]);
    }
  });

  if (
    explicitPermissions.includes(INVENTORY_RAW_PERMISSIONS.UBICACIONES_CREATE) ||
    explicitPermissions.includes(INVENTORY_RAW_PERMISSIONS.ARTICULOS_CREATE)
  ) {
    allowedActions.add(INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_ARTICLE);
  }

  if (explicitPermissions.includes(INVENTORY_RAW_PERMISSIONS.UBICACIONES_CREATE)) {
    allowedActions.add(INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_MOVEMENT);
  }
};

export const getInventoryPermissions = (user) => {
  const role = user?.tipo_usuario;
  const explicitPermissions = getExplicitPermissions(user);
  const allowedActions = new Set(explicitPermissions ? [] : ROLE_ACTIONS[role] || []);
  applyRawPermissionMappings(allowedActions, explicitPermissions);
  const hasInventoryAccessAction = Array.from(allowedActions).some(
    (action) =>
      ![
        INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_ARTICLE,
        INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_MOVEMENT,
      ].includes(action)
  );
  return {
    role,
    canAccessInventory: hasInventoryAccessAction,
    can: (action) => allowedActions.has(action),
  };
};

export const hasInventoryAction = (user, action) => getInventoryPermissions(user).can(action);

export const canCreateLocationFromArticle = (user) =>
  getInventoryPermissions(user).can(INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_ARTICLE);

export const canCreateLocationFromMovement = (user) => {
  const permissions = getInventoryPermissions(user);
  return permissions.can(INVENTORY_ACTIONS.LOCATIONS_CREATE_FROM_MOVEMENT);
};
