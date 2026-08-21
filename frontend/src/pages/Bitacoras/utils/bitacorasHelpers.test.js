import {
  formatLocalTimestamp,
  getLocalDateTimeValue,
  normalizeLocalDateTimeForPayload,
} from './bitacorasHelpers';

describe('bitacorasHelpers', () => {
  test('construye datetime-local con componentes locales sin convertir a UTC', () => {
    const localDate = new Date(2026, 7, 21, 8, 35, 0);

    expect(getLocalDateTimeValue(localDate)).toBe('2026-08-21T08:35');
    expect(getLocalDateTimeValue(localDate)).not.toContain('Z');
  });

  test('preserva exactamente la hora seleccionada para el payload', () => {
    const selected = '2026-08-21T08:30';

    expect(normalizeLocalDateTimeForPayload(selected)).toBe(selected);
    expect(normalizeLocalDateTimeForPayload(selected)).not.toBe('2026-08-21T13:30:00.000Z');
  });

  test('admite segundos y fracciones locales sin agregar offset', () => {
    expect(normalizeLocalDateTimeForPayload('2026-08-21T08:30:45.123')).toBe(
      '2026-08-21T08:30:45.123'
    );
    expect(normalizeLocalDateTimeForPayload('2026-08-21T08:30Z')).toBe('');
    expect(normalizeLocalDateTimeForPayload('2026-08-21T08:30-05:00')).toBe('');
  });

  test('formatea el timestamp mediante componentes locales explícitos', () => {
    expect(formatLocalTimestamp('2026-08-21T08:30:45.000')).toBe('21/08/2026 08:30');
    expect(formatLocalTimestamp('valor inválido')).toBe('');
  });

  test('convierte una serialización UTC explícita a la hora local indicada', () => {
    expect(
      formatLocalTimestamp('2026-08-21T13:30:00.000Z', { timeZone: 'America/Guayaquil' })
    ).toBe('21/08/2026 08:30');
  });
});
