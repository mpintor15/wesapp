export const CONFIGURACION_ACTIONS = {
  CLIENTES_VIEW: 'clientes.ver',
  CLIENTES_CREATE: 'clientes.crear',
  CLIENTES_EDIT: 'clientes.editar',
  CLIENTES_DELETE: 'clientes.eliminar',
  UBICACIONES_VIEW: 'inventario.ubicaciones.ver',
  UBICACIONES_CREATE: 'inventario.ubicaciones.crear',
  UBICACIONES_EDIT: 'inventario.ubicaciones.editar',
  UBICACIONES_DELETE: 'inventario.ubicaciones.eliminar',
};

const ROLE_ACTIONS = {
  gerente: Object.values(CONFIGURACION_ACTIONS),
  contador: [
    CONFIGURACION_ACTIONS.CLIENTES_VIEW,
    CONFIGURACION_ACTIONS.CLIENTES_CREATE,
    CONFIGURACION_ACTIONS.CLIENTES_EDIT,
    CONFIGURACION_ACTIONS.CLIENTES_DELETE,
  ],
  secretario: [
    CONFIGURACION_ACTIONS.CLIENTES_VIEW,
    CONFIGURACION_ACTIONS.CLIENTES_CREATE,
    CONFIGURACION_ACTIONS.UBICACIONES_VIEW,
  ],
  supervisor: [
    CONFIGURACION_ACTIONS.UBICACIONES_VIEW,
    CONFIGURACION_ACTIONS.UBICACIONES_CREATE,
    CONFIGURACION_ACTIONS.UBICACIONES_EDIT,
  ],
};

export const canViewLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_VIEW);

export const canCreateLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_CREATE);

export const canEditLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_EDIT);

export const canDeleteLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_DELETE);

const getExplicitPermissions = (user) => {
  const permissions = user?.permisos || user?.permissions;
  return Array.isArray(permissions) ? permissions : null;
};

export const getConfiguracionPermissions = (user) => {
  const explicitPermissions = getExplicitPermissions(user);
  const allowedActions = new Set(explicitPermissions || ROLE_ACTIONS[user?.tipo_usuario] || []);
  const can = (action) => allowedActions.has(action);

  return {
    can,
    canViewClientes: can(CONFIGURACION_ACTIONS.CLIENTES_VIEW),
    canCreateCliente: can(CONFIGURACION_ACTIONS.CLIENTES_CREATE),
    canEditCliente: can(CONFIGURACION_ACTIONS.CLIENTES_EDIT),
    canDeleteCliente: can(CONFIGURACION_ACTIONS.CLIENTES_DELETE),
    canViewUbicaciones: canViewLocations(can),
    canCreateUbicacion: canCreateLocations(can),
    canEditUbicacion: canEditLocations(can),
    canDeleteUbicacion: canDeleteLocations(can),
  };
};
