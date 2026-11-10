import { suggestCuentaUsuario, getAssignableTipos } from './usuariosHelpers';

describe('getAssignableTipos', () => {
  const values = (role) => getAssignableTipos(role).map((tipo) => tipo.value);

  test('gerente asigna cualquier rol', () => {
    expect(values('gerente')).toEqual([
      'gerente',
      'secretario',
      'supervisor',
      'contador',
      'guardia',
      'monitorista',
    ]);
  });

  test('secretario asigna cualquier rol menos gerente', () => {
    expect(values('secretario')).toEqual([
      'secretario',
      'supervisor',
      'contador',
      'guardia',
      'monitorista',
    ]);
  });

  test('supervisor solo asigna guardia y otros roles ninguno', () => {
    expect(values('supervisor')).toEqual(['guardia']);
    expect(values('contador')).toEqual([]);
    expect(values('cliente')).toEqual([]);
  });
});

describe('suggestCuentaUsuario', () => {
  test.each([
    ['Módulo 1 Monitoreo', 'modulo1.monitoreo'],
    ['Módulo 2 Monitoreo', 'modulo2.monitoreo'],
    ['  Estación  Norte ', 'estacion.norte'],
    ['Garita', 'garita'],
    ['', ''],
  ])('%s -> %s', (nombre, esperado) => {
    expect(suggestCuentaUsuario(nombre)).toBe(esperado);
  });
});
