const { ESTADOS_COLABORADOR } = require('../modules/personal/personal.constants');
const {
  buildColaboradorExcelRow,
  buildColaboradoresFilters,
  isValidEstadoColaborador,
  normalizeEstadoColaborador,
} = require('../modules/personal/personal.domain');

describe('personal domain helpers', () => {
  test('normaliza y valida estados de colaborador', () => {
    expect(ESTADOS_COLABORADOR).toEqual(['activo', 'inactivo']);
    expect(Object.isFrozen(ESTADOS_COLABORADOR)).toBe(true);
    expect(normalizeEstadoColaborador(' Activo ')).toBe('activo');
    expect(normalizeEstadoColaborador(undefined)).toBe('');
    expect(isValidEstadoColaborador('activo')).toBe(true);
    expect(isValidEstadoColaborador('suspendido')).toBe(false);
  });

  test('construye filtros sin mutar la entrada, con canAccessSensitive true por defecto', () => {
    const input = { search: 'ana', estado: ' INACTIVO ', cargo: 'Guardia' };

    expect(buildColaboradoresFilters(input)).toEqual({
      search: 'ana',
      estado: 'inactivo',
      cargo: 'Guardia',
      canAccessSensitive: true,
    });
    expect(input).toEqual({ search: 'ana', estado: ' INACTIVO ', cargo: 'Guardia' });
  });

  test('propaga canAccessSensitive false cuando el rol no tiene acceso a datos sensibles', () => {
    expect(buildColaboradoresFilters({ search: 'ana', canAccessSensitive: false })).toEqual({
      search: 'ana',
      estado: undefined,
      cargo: undefined,
      canAccessSensitive: false,
    });
  });

  test('prepara filas de Excel conservando vacíos y sueldo cero', () => {
    const row = {
      nombres_completos: 'Ana Torres',
      cedula: '0102030405',
      fecha_nacimiento: null,
      cargo: 'Analista',
      celular: null,
      banco: '',
      numero_cuenta: null,
      sueldo: 0,
      estado: 'activo',
    };

    expect(buildColaboradorExcelRow(row)).toEqual({
      nombres_completos: 'Ana Torres',
      cedula: '0102030405',
      fecha_nacimiento: '',
      cargo: 'Analista',
      celular: '',
      banco: '',
      numero_cuenta: '',
      sueldo: '',
      estado: 'activo',
    });
    expect(row.sueldo).toBe(0);
  });

  test('prepara filas de Excel con fecha y sueldo numérico', () => {
    expect(
      buildColaboradorExcelRow({
        nombres_completos: 'María Núñez',
        cedula: '0102030405',
        fecha_nacimiento: '1992-05-09',
        cargo: 'Supervisora',
        celular: '0999999999',
        banco: 'Banco',
        numero_cuenta: '123',
        sueldo: '789.45',
        estado: 'activo',
      })
    ).toEqual(
      expect.objectContaining({
        fecha_nacimiento: expect.any(String),
        sueldo: 789.45,
      })
    );
  });
});
