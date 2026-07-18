const {
  isValidDateString,
  parseStrictPositiveInteger,
  parseStrictPositiveNumber,
  validateOptionalDateBounds,
  validateOptionalDateRange,
} = require('../utils/inputValidation');

describe('inputValidation', () => {
  test.each([
    ['1', true, 1],
    [1, true, 1],
    ['0', false, undefined],
    ['-1', false, undefined],
    ['1.5', false, undefined],
    ['abc', false, undefined],
    ['12abc', false, undefined],
    ['', false, undefined],
    ['   ', false, undefined],
    ['Infinity', false, undefined],
    ['NaN', false, undefined],
    ['1e2', false, undefined],
    [String(Number.MAX_SAFE_INTEGER + 1), false, undefined],
  ])('parseStrictPositiveInteger(%p)', (value, expectedValid, expectedValue) => {
    const result = parseStrictPositiveInteger(value, 'ID inválido');

    expect(result.valid).toBe(expectedValid);
    if (expectedValid) {
      expect(result.value).toBe(expectedValue);
    } else {
      expect(result.status).toBe(400);
    }
  });

  test.each([
    ['10', true, 10],
    ['10.25', true, 10.25],
    ['0', false, undefined],
    ['-1', false, undefined],
    ['1e2', false, undefined],
    ['12abc', false, undefined],
    ['NaN', false, undefined],
  ])('parseStrictPositiveNumber(%p)', (value, expectedValid, expectedValue) => {
    const result = parseStrictPositiveNumber(value, 'Número inválido');

    expect(result.valid).toBe(expectedValid);
    if (expectedValid) {
      expect(result.value).toBe(expectedValue);
    }
  });

  test.each([
    ['2024-02-29', true],
    ['2026-02-30', false],
    ['2026-13-01', false],
    ['2026-00-10', false],
    ['2026-01-00', false],
    ['2026-1-1', false],
    ['01/02/2026', false],
    ['2026-01-01T00:00:00Z', false],
  ])('isValidDateString(%p)', (value, expected) => {
    expect(isValidDateString(value)).toBe(expected);
  });

  test('validateOptionalDateRange exige ambos límites y rechaza rango invertido', () => {
    expect(validateOptionalDateRange('2024-01-01', undefined).valid).toBe(false);
    expect(validateOptionalDateRange('2024-02-01', '2024-01-01').valid).toBe(false);
    expect(validateOptionalDateRange('2024-01-01', '2024-02-01').valid).toBe(true);
  });

  test('validateOptionalDateBounds permite un límite y rechaza rango invertido', () => {
    expect(validateOptionalDateBounds('2024-01-01', undefined).valid).toBe(true);
    expect(validateOptionalDateBounds(undefined, '2024-02-01').valid).toBe(true);
    expect(validateOptionalDateBounds('2024-02-01', '2024-01-01').valid).toBe(false);
  });
});
