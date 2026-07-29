import { can, canAny } from '../../../auth/authorization';
import { PERMISSIONS } from '../../../auth/permissions';

export const getCuentasPermissions = (user) => {
  return {
    canCreateFactura: can(user, PERMISSIONS.CUENTAS_FACTURAS_CREAR),
    canEditFactura: can(user, PERMISSIONS.CUENTAS_FACTURAS_EDITAR),
    canCancelFactura: can(user, PERMISSIONS.CUENTAS_FACTURAS_CANCELAR),
    canDeleteFactura: can(user, PERMISSIONS.CUENTAS_FACTURAS_ELIMINAR),
    canExportReportes: can(user, PERMISSIONS.CUENTAS_REPORTES_EXPORTAR),
    canCreatePago: can(user, PERMISSIONS.CUENTAS_ABONOS_CREAR),
    canManageClientes: canAny(user, [
      PERMISSIONS.CUENTAS_CLIENTES_CREAR,
      PERMISSIONS.CUENTAS_CLIENTES_EDITAR,
      PERMISSIONS.CUENTAS_CLIENTES_ELIMINAR,
    ]),
  };
};
