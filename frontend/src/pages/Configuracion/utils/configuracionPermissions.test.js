import { PERMISSIONS } from '../../../auth/permissions';
import { CONFIGURACION_ACTIONS, getConfiguracionPermissions } from './configuracionPermissions';

const user = (tipo_usuario, extra = {}) => ({
  id: 1,
  usuario: tipo_usuario,
  tipo_usuario,
  activo: true,
  ...extra,
});

describe('configuracionPermissions', () => {
  test('gerente puede gestionar clientes y ubicaciones', () => {
    const permissions = getConfiguracionPermissions(user('gerente'));

    expect(permissions.canCreateCliente).toBe(true);
    expect(permissions.canDeleteCliente).toBe(true);
    expect(permissions.canCreateUbicacion).toBe(true);
    expect(permissions.canDeleteUbicacion).toBe(true);
  });

  test('secretario conserva acceso limitado de configuración', () => {
    const permissions = getConfiguracionPermissions(user('secretario'));

    expect(permissions.canViewClientes).toBe(true);
    expect(permissions.canCreateCliente).toBe(true);
    expect(permissions.canEditCliente).toBe(false);
    expect(permissions.canViewUbicaciones).toBe(true);
    expect(permissions.canCreateUbicacion).toBe(false);
  });

  test('permisos explícitos tienen prioridad sobre fallback de rol', () => {
    const permissions = getConfiguracionPermissions(
      user('gerente', {
        permisos: [PERMISSIONS.CLIENTES_VER, PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR],
      })
    );

    expect(permissions.canViewClientes).toBe(true);
    expect(permissions.canCreateCliente).toBe(false);
    expect(permissions.canEditUbicacion).toBe(true);
    expect(permissions.canDeleteUbicacion).toBe(false);
    expect(permissions.can(CONFIGURACION_ACTIONS.UBICACIONES_EDIT)).toBe(true);
  });
});
