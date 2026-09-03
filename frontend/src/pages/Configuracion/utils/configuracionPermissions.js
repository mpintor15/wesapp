import { can } from '../../../auth/authorization';
import { PERMISSIONS } from '../../../auth/permissions';

export const CONFIGURACION_ACTIONS = {
  CLIENTES_VIEW: PERMISSIONS.CLIENTES_VER,
  CLIENTES_CREATE: PERMISSIONS.CLIENTES_CREAR,
  CLIENTES_EDIT: PERMISSIONS.CLIENTES_EDITAR,
  CLIENTES_DELETE: PERMISSIONS.CLIENTES_ELIMINAR,
  UBICACIONES_VIEW: PERMISSIONS.INVENTARIO_UBICACIONES_VER,
  UBICACIONES_CREATE: PERMISSIONS.INVENTARIO_UBICACIONES_CREAR,
  UBICACIONES_EDIT: PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR,
  UBICACIONES_DELETE: PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR,
  UBICACIONES_REASSIGN_CLIENT: PERMISSIONS.INVENTARIO_UBICACIONES_REASIGNAR_CLIENTE,
  URBANIZACION_MANAGE: PERMISSIONS.BITACORAS_URBANIZACION_ADMINISTRAR,
};

export const canViewLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_VIEW);

export const canCreateLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_CREATE);

export const canEditLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_EDIT);

export const canDeleteLocations = (can) => can(CONFIGURACION_ACTIONS.UBICACIONES_DELETE);

export const canReassignLocationCliente = (can) =>
  can(CONFIGURACION_ACTIONS.UBICACIONES_REASSIGN_CLIENT);

export const getConfiguracionPermissions = (user) => {
  const canAction = (action) => can(user, action);

  return {
    can: canAction,
    canViewClientes: canAction(CONFIGURACION_ACTIONS.CLIENTES_VIEW),
    canCreateCliente: canAction(CONFIGURACION_ACTIONS.CLIENTES_CREATE),
    canEditCliente: canAction(CONFIGURACION_ACTIONS.CLIENTES_EDIT),
    canDeleteCliente: canAction(CONFIGURACION_ACTIONS.CLIENTES_DELETE),
    canViewUbicaciones: canViewLocations(canAction),
    canCreateUbicacion: canCreateLocations(canAction),
    canEditUbicacion: canEditLocations(canAction),
    canDeleteUbicacion: canDeleteLocations(canAction),
    canReassignUbicacionCliente: canReassignLocationCliente(canAction),
    canManageUrbanizacion: canAction(CONFIGURACION_ACTIONS.URBANIZACION_MANAGE),
  };
};
