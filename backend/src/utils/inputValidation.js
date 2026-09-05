const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// Los montos monetarios (sueldo, valor_factura, valor_abono, ...) se
// almacenan en columnas NUMERIC(10,2): 8 dígitos enteros + 2 decimales.
// Sin este tope, un valor plausible-pero-erróneo (p.ej. un typo con dígitos
// de más) pasa la validación de "positivo" y solo falla al llegar a
// PostgreSQL con "numeric field overflow" (22003), que no está mapeado a un
// 400 y termina como un 500 genérico.
const MAX_NUMERIC_10_2 = 99999999.99;

const parseStrictPositiveInteger = (value, message, { max = MAX_SAFE_ID } = {}) => {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, status: 400, message };
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) {
    return { valid: false, status: 400, message };
  }

  return { valid: true, value: parsed };
};

const parseStrictPositiveNumber = (value, message, { max = MAX_NUMERIC_10_2 } = {}) => {
  const normalized = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { valid: false, status: 400, message };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) {
    return { valid: false, status: 400, message };
  }

  return { valid: true, value: parsed };
};

const isValidDateString = (value) => {
  const match = DATE_PATTERN.exec(String(value ?? ''));
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const validateRequiredDateString = (value, message) => {
  if (!isValidDateString(value)) {
    return { valid: false, status: 400, message };
  }
  return { valid: true, value };
};

const validateOptionalDateRange = (
  start,
  end,
  {
    bothRequiredMessage = 'Debes enviar fecha_inicio y fecha_fin juntas',
    invalidDateMessage = 'Las fechas deben tener formato YYYY-MM-DD y ser reales',
    invertedRangeMessage = 'El rango de fechas es inválido',
  } = {}
) => {
  if ((start && !end) || (!start && end)) {
    return { valid: false, status: 400, message: bothRequiredMessage };
  }

  if (!start && !end) {
    return { valid: true, value: {} };
  }

  if (!isValidDateString(start) || !isValidDateString(end)) {
    return { valid: false, status: 400, message: invalidDateMessage };
  }

  if (start > end) {
    return { valid: false, status: 400, message: invertedRangeMessage };
  }

  return { valid: true, value: { start, end } };
};

const validateOptionalDateBounds = (
  start,
  end,
  {
    invalidDateMessage = 'Las fechas deben tener formato YYYY-MM-DD y ser reales',
    invertedRangeMessage = 'El rango de fechas es inválido',
  } = {}
) => {
  if (start && !isValidDateString(start)) {
    return { valid: false, status: 400, message: invalidDateMessage };
  }

  if (end && !isValidDateString(end)) {
    return { valid: false, status: 400, message: invalidDateMessage };
  }

  if (start && end && start > end) {
    return { valid: false, status: 400, message: invertedRangeMessage };
  }

  return { valid: true, value: { start, end } };
};

module.exports = {
  isValidDateString,
  MAX_NUMERIC_10_2,
  parseStrictPositiveInteger,
  parseStrictPositiveNumber,
  validateOptionalDateBounds,
  validateOptionalDateRange,
  validateRequiredDateString,
};
