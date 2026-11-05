import { suggestClienteUsuario } from './clienteUsuario';

describe('suggestClienteUsuario', () => {
  test.each([
    ['Banco Pichincha', 'BPichincha'],
    ['Centro Comercial El Recreo', 'CRecreo'],
    ['Urbanización Los Álamos', 'UAlamos'],
    ['Ciudad de Quito', 'CQuito'],
    ['Condominio', 'Condominio'],
    ['', ''],
  ])('%s -> %s', (nombre, esperado) => {
    expect(suggestClienteUsuario(nombre)).toBe(esperado);
  });
});
