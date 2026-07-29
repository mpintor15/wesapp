import { getCuentasPermissions } from './cuentasPermissions';

describe('cuentasPermissions', () => {
  test('gerente conserva las capacidades administrativas actuales', () => {
    expect(getCuentasPermissions({ tipo_usuario: 'gerente' })).toEqual({
      canCreateFactura: true,
      canEditFactura: true,
      canCancelFactura: true,
      canDeleteFactura: true,
      canExportReportes: true,
      canCreatePago: true,
      canManageClientes: true,
    });
  });

  test('usuario no gerente conserva restricciones administrativas', () => {
    const permissions = getCuentasPermissions({ tipo_usuario: 'secretario' });

    expect(permissions).toEqual(
      expect.objectContaining({
        canCreateFactura: false,
        canEditFactura: false,
        canCancelFactura: false,
        canDeleteFactura: false,
        canExportReportes: true,
        canCreatePago: true,
        canManageClientes: true,
      })
    );
  });

  test('usuario ausente no obtiene capacidades administrativas', () => {
    const permissions = getCuentasPermissions(null);

    expect(permissions.canCreateFactura).toBe(false);
    expect(permissions.canEditFactura).toBe(false);
    expect(permissions.canCancelFactura).toBe(false);
    expect(permissions.canDeleteFactura).toBe(false);
  });
});
