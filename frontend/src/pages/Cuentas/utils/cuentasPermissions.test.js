import { getCuentasPermissions } from './cuentasPermissions';
import { PERMISSIONS } from '../../../auth/permissions';

const user = (tipo_usuario, extra = {}) => ({
  id: 1,
  usuario: tipo_usuario,
  tipo_usuario,
  activo: true,
  ...extra,
});

describe('cuentasPermissions', () => {
  test('gerente conserva las capacidades administrativas actuales', () => {
    expect(getCuentasPermissions(user('gerente'))).toEqual({
      canCreateFactura: true,
      canEditFactura: true,
      canCancelFactura: true,
      canDeleteFactura: true,
      canExportReportes: true,
      canCreatePago: true,
      canManageClientes: true,
    });
  });

  test('secretario conserva permisos de lectura y reportes sin acciones administrativas', () => {
    const permissions = getCuentasPermissions(user('secretario'));

    expect(permissions).toEqual(
      expect.objectContaining({
        canCreateFactura: false,
        canEditFactura: false,
        canCancelFactura: false,
        canDeleteFactura: false,
        canExportReportes: true,
        canCreatePago: false,
        canManageClientes: true,
      })
    );
  });

  test('contador puede gestionar facturas sin cancelar documentos', () => {
    const permissions = getCuentasPermissions(user('contador'));

    expect(permissions.canCreateFactura).toBe(true);
    expect(permissions.canEditFactura).toBe(true);
    expect(permissions.canDeleteFactura).toBe(true);
    expect(permissions.canCancelFactura).toBe(false);
    expect(permissions.canCreatePago).toBe(true);
  });

  test('permisos explícitos tienen prioridad para acciones de cuentas', () => {
    const permissions = getCuentasPermissions(
      user('secretario', {
        permisos: [PERMISSIONS.CUENTAS_FACTURAS_CANCELAR, PERMISSIONS.CUENTAS_ABONOS_CREAR],
      })
    );

    expect(permissions.canCancelFactura).toBe(true);
    expect(permissions.canCreatePago).toBe(true);
    expect(permissions.canCreateFactura).toBe(false);
  });

  test('usuario ausente no obtiene capacidades administrativas', () => {
    const permissions = getCuentasPermissions(null);

    expect(permissions.canCreateFactura).toBe(false);
    expect(permissions.canEditFactura).toBe(false);
    expect(permissions.canCancelFactura).toBe(false);
    expect(permissions.canDeleteFactura).toBe(false);
    expect(permissions.canExportReportes).toBe(false);
  });
});
