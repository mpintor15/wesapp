import { canAny } from './authorization';
import { MODULE_ACCESS_PERMISSIONS } from './modulePermissions';
import { PERMISSIONS } from './permissions';
import { getInventoryPermissions } from '../pages/Inventario/utils/inventarioPermissions';

const user = (permisos) => ({
  id: 1,
  usuario: 'custom',
  tipo_usuario: 'custom',
  activo: true,
  permisos,
});

describe('modulePermissions', () => {
  test('permiso de ubicaciones concede Configuración pero no Inventario', () => {
    const ubicacionesUser = user([PERMISSIONS.INVENTARIO_UBICACIONES_VER]);

    expect(canAny(ubicacionesUser, MODULE_ACCESS_PERMISSIONS.configuracion)).toBe(true);
    expect(canAny(ubicacionesUser, MODULE_ACCESS_PERMISSIONS.inventario)).toBe(false);
    expect(getInventoryPermissions(ubicacionesUser).canAccessInventory).toBe(false);
  });

  test('permisos operativos de inventario coinciden con el helper interno', () => {
    [
      PERMISSIONS.INVENTARIO_ARTICULOS_VER,
      PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER,
      PERMISSIONS.INVENTARIO_BAJAS_VER,
    ].forEach((permission) => {
      const inventoryUser = user([permission]);

      expect(canAny(inventoryUser, MODULE_ACCESS_PERMISSIONS.inventario)).toBe(true);
      expect(getInventoryPermissions(inventoryUser).canAccessInventory).toBe(true);
    });
  });
});
