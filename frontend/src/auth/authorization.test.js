import { can, canAll, canAny } from './authorization';
import { PERMISSIONS } from './permissions';

const user = (tipo_usuario, extra = {}) => ({
  id: 1,
  usuario: tipo_usuario || 'sin-rol',
  tipo_usuario,
  activo: true,
  ...extra,
});

describe('authorization', () => {
  test('usuario sin sesión o mal formado no obtiene permisos', () => {
    expect(can(null, PERMISSIONS.CLIENTES_VER)).toBe(false);
    expect(can({}, PERMISSIONS.CLIENTES_VER)).toBe(false);
    expect(can(user(undefined), PERMISSIONS.CLIENTES_VER)).toBe(false);
    expect(can(user('gerente', { activo: false }), PERMISSIONS.CLIENTES_VER)).toBe(false);
  });

  test('permiso conocido concedido y denegado por fallback de rol', () => {
    expect(can(user('contador'), PERMISSIONS.CUENTAS_FACTURAS_CREAR)).toBe(true);
    expect(can(user('secretario'), PERMISSIONS.CUENTAS_FACTURAS_CREAR)).toBe(false);
  });

  test('permiso desconocido se deniega incluso para gerente', () => {
    expect(can(user('gerente'), 'inventario.ubicaciones.publicar')).toBe(false);
  });

  test('gerente autoriza cualquier permiso conocido', () => {
    expect(can(user('gerente'), PERMISSIONS.USUARIOS_ELIMINAR)).toBe(true);
    expect(can(user('gerente'), PERMISSIONS.INVENTARIO_MOVIMIENTOS_REGENERAR_PDF)).toBe(true);
  });

  test('permisos explícitos tienen prioridad sobre fallback de rol', () => {
    expect(
      can(user('gerente', { permisos: [PERMISSIONS.CLIENTES_VER] }), PERMISSIONS.USUARIOS_VER)
    ).toBe(false);
    expect(
      can(user('contador', { permisos: [PERMISSIONS.PERSONAL_CREAR] }), PERMISSIONS.PERSONAL_CREAR)
    ).toBe(true);
  });

  test('soporta colecciones permisos y permissions', () => {
    expect(
      can(user('custom', { permisos: [PERMISSIONS.CLIENTES_VER] }), PERMISSIONS.CLIENTES_VER)
    ).toBe(true);
    expect(
      can(
        user('custom', { permissions: [PERMISSIONS.INVENTARIO_UBICACIONES_VER] }),
        PERMISSIONS.INVENTARIO_UBICACIONES_VER
      )
    ).toBe(true);
  });

  test('matriz fallback conserva permisos críticos por rol', () => {
    expect(can(user('contador'), PERMISSIONS.CUENTAS_FACTURAS_CREAR)).toBe(true);
    expect(can(user('secretario'), PERMISSIONS.CUENTAS_ABONOS_CREAR)).toBe(false);
    expect(can(user('supervisor'), PERMISSIONS.INVENTARIO_MOVIMIENTOS_ANULAR)).toBe(true);
    expect(can(user('supervisor'), PERMISSIONS.INVENTARIO_MOVIMIENTOS_ELIMINAR)).toBe(false);
  });

  test('canAny exige al menos un permiso concedido', () => {
    expect(canAny(user('secretario'), [])).toBe(false);
    expect(
      canAny(user('secretario'), [PERMISSIONS.USUARIOS_VER, PERMISSIONS.INVENTARIO_UBICACIONES_VER])
    ).toBe(true);
  });

  test('canAll exige todos los permisos y acepta lista vacía por verdad vacía', () => {
    expect(canAll(user('secretario'), [])).toBe(true);
    expect(
      canAll(user('secretario'), [
        PERMISSIONS.INVENTARIO_ARTICULOS_VER,
        PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER,
      ])
    ).toBe(true);
    expect(
      canAll(user('secretario'), [
        PERMISSIONS.INVENTARIO_ARTICULOS_VER,
        PERMISSIONS.INVENTARIO_ARTICULOS_CREAR,
      ])
    ).toBe(false);
  });
});
