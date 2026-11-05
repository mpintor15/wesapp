const { visitorNamesLabel, visitorsFromVisit } = require('../modules/bitacoras/bitacoras.domain');

describe('visitantes de una visita', () => {
  test('visitorNamesLabel une los nombres del grupo y omite vacíos', () => {
    expect(
      visitorNamesLabel({
        groupEntries: [{ nombre: ' Ana ' }, { nombre: '' }, { nombre: 'Luis' }],
        legacyName: 'Antiguo',
      })
    ).toBe('Ana, Luis');
  });

  test('visitorNamesLabel cae al nombre legacy sin grupo', () => {
    expect(visitorNamesLabel({ groupEntries: undefined, legacyName: 'Carlos' })).toBe('Carlos');
    expect(visitorNamesLabel()).toBe('');
  });

  test('visitorsFromVisit lee nombre y cédula de cada persona del grupo', () => {
    const visit = {
      visitantes: [
        [
          { field_key: 'nombre', type: 'text', value: 'Ana' },
          { field_key: 'cedula', type: 'cedula', value: '0912345678' },
        ],
        [{ field_key: 'nombre', type: 'text', value: 'Luis' }],
      ],
    };

    expect(visitorsFromVisit(visit)).toEqual([
      { nombre: 'Ana', cedula: '0912345678' },
      { nombre: 'Luis', cedula: '' },
    ]);
  });

  test('visitorsFromVisit usa el tipo del campo si la clave no es nombre/cedula', () => {
    const visit = {
      visitantes: [
        [
          { field_key: 'nombre_apellido', type: 'text', value: 'Ana' },
          { field_key: 'documento', type: 'cedula', value: '0912345678' },
        ],
      ],
    };

    expect(visitorsFromVisit(visit)).toEqual([{ nombre: 'Ana', cedula: '0912345678' }]);
  });

  test('visitorsFromVisit cae a los campos legacy de la visita', () => {
    expect(
      visitorsFromVisit({ visitantes: [], visitante_nombre: 'Carlos', visitante_documento: '1' })
    ).toEqual([{ nombre: 'Carlos', cedula: '1' }]);
    expect(visitorsFromVisit({ visitantes: [] })).toEqual([]);
  });
});
