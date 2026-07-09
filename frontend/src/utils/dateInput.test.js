import { displayToIsoDate, isoToDisplayDate, sanitizeDisplayDate } from './dateInput';

describe('dateInput helpers', () => {
  describe('isoToDisplayDate', () => {
    test('convierte yyyy-mm-dd a dd/mm/aaaa', () => {
      expect(isoToDisplayDate('2026-07-09')).toBe('09/07/2026');
    });

    test('rechaza formatos incompletos o no ISO', () => {
      expect(isoToDisplayDate('2026-7-9')).toBe('');
      expect(isoToDisplayDate('09/07/2026')).toBe('');
      expect(isoToDisplayDate('')).toBe('');
    });

    test('acepta 29 de febrero en año bisiesto', () => {
      expect(isoToDisplayDate('2024-02-29')).toBe('29/02/2024');
    });

    test('rechaza 29 de febrero en año no bisiesto', () => {
      expect(isoToDisplayDate('2023-02-29')).toBe('');
    });

    test('rechaza meses y días fuera de rango', () => {
      expect(isoToDisplayDate('2026-13-01')).toBe('');
      expect(isoToDisplayDate('2026-04-31')).toBe('');
      expect(isoToDisplayDate('2026-00-10')).toBe('');
    });
  });

  describe('displayToIsoDate', () => {
    test('convierte dd/mm/aaaa a yyyy-mm-dd', () => {
      expect(displayToIsoDate('09/07/2026')).toBe('2026-07-09');
    });

    test('rechaza input incompleto', () => {
      expect(displayToIsoDate('09/07')).toBe('');
      expect(displayToIsoDate('09/07/26')).toBe('');
    });

    test('rechaza formato ISO cuando espera display', () => {
      expect(displayToIsoDate('2026-07-09')).toBe('');
    });

    test('valida años bisiestos', () => {
      expect(displayToIsoDate('29/02/2024')).toBe('2024-02-29');
      expect(displayToIsoDate('29/02/2023')).toBe('');
    });
  });

  describe('sanitizeDisplayDate', () => {
    test('inserta separadores dd/mm/aaaa progresivamente', () => {
      expect(sanitizeDisplayDate('1')).toBe('1');
      expect(sanitizeDisplayDate('120')).toBe('12/0');
      expect(sanitizeDisplayDate('12072026')).toBe('12/07/2026');
    });

    test('elimina caracteres no numéricos y limita a 8 dígitos', () => {
      expect(sanitizeDisplayDate('12-a7-2026-extra')).toBe('12/72/026');
      expect(sanitizeDisplayDate('120720261234')).toBe('12/07/2026');
    });
  });
});
