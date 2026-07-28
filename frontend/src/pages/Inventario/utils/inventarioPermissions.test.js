import {
  canCreateLocationFromArticle,
  canCreateLocationFromMovement,
  getInventoryPermissions,
  INVENTORY_ACTIONS,
  INVENTORY_RAW_PERMISSIONS,
} from './inventarioPermissions';

describe('inventarioPermissions', () => {
  test('gerente tiene acciones administrativas de inventario', () => {
    const permissions = getInventoryPermissions({ tipo_usuario: 'gerente' });

    expect(permissions.canAccessInventory).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_DELETE_ADMIN)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_REGENERATE)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.BAJAS_DELETE_ADMIN)).toBe(true);
  });

  test('supervisor no puede eliminar administrativamente ni regenerar PDF', () => {
    const permissions = getInventoryPermissions({ tipo_usuario: 'supervisor' });

    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_BAJA)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_VOID)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_DOWNLOAD)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_DELETE_ADMIN)).toBe(false);
    expect(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_REGENERATE)).toBe(false);
  });

  test('secretario solo tiene lectura, creación de movimientos, PDF y reportes', () => {
    const permissions = getInventoryPermissions({ tipo_usuario: 'secretario' });

    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_VIEW)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_CREATE)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_DOWNLOAD)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.REPORTS_EXPORT)).toBe(true);
    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_EDIT)).toBe(false);
    expect(permissions.can(INVENTORY_ACTIONS.BAJAS_CREATE)).toBe(false);
  });

  test('contador no accede al módulo de inventario', () => {
    const permissions = getInventoryPermissions({ tipo_usuario: 'contador' });

    expect(permissions.canAccessInventory).toBe(false);
    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_VIEW)).toBe(false);
  });

  test('permisos de ubicaciones no conceden acciones de artículos por accidente', () => {
    const permissions = getInventoryPermissions({
      tipo_usuario: 'custom',
      permisos: ['inventario.ubicaciones.ver', 'inventario.ubicaciones.crear'],
    });

    expect(permissions.canAccessInventory).toBe(false);
    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_VIEW)).toBe(false);
    expect(permissions.can(INVENTORY_ACTIONS.ARTICULOS_CREATE)).toBe(false);
  });

  test('crear ubicación desde artículo acepta permiso de ubicación o crear artículo', () => {
    expect(
      canCreateLocationFromArticle({
        tipo_usuario: 'custom',
        permisos: [INVENTORY_RAW_PERMISSIONS.UBICACIONES_CREATE],
      })
    ).toBe(true);
    expect(
      canCreateLocationFromArticle({
        tipo_usuario: 'custom',
        permisos: [INVENTORY_RAW_PERMISSIONS.ARTICULOS_CREATE],
      })
    ).toBe(true);
  });

  test('crear o editar artículos no habilita nueva ubicación si no está en la política OR', () => {
    expect(
      canCreateLocationFromArticle({
        tipo_usuario: 'custom',
        permisos: [INVENTORY_ACTIONS.ARTICULOS_CREATE, INVENTORY_RAW_PERMISSIONS.ARTICULOS_EDIT],
      })
    ).toBe(false);
  });

  test('crear ubicación desde movimiento exige permiso de ubicación', () => {
    expect(
      canCreateLocationFromMovement({
        tipo_usuario: 'custom',
        permisos: [INVENTORY_RAW_PERMISSIONS.UBICACIONES_CREATE],
      })
    ).toBe(true);
    expect(
      canCreateLocationFromMovement({
        tipo_usuario: 'custom',
        permisos: [INVENTORY_RAW_PERMISSIONS.MOVIMIENTOS_CREATE],
      })
    ).toBe(false);
  });
});
