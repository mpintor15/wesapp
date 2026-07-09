export const isValidDate = (day, month, year) => {
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const isLeapYear = numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysPerMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return (
    numericYear >= 1 &&
    numericMonth >= 1 &&
    numericMonth <= 12 &&
    numericDay >= 1 &&
    numericDay <= daysPerMonth[numericMonth - 1]
  );
};

export const isoToDisplayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const [, year, month, day] = match;
  return isValidDate(day, month, year) ? `${day}/${month}/${year}` : '';
};

export const displayToIsoDate = (value) => {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';

  const [, day, month, year] = match;
  return isValidDate(day, month, year) ? `${year}-${month}-${day}` : '';
};

export const sanitizeDisplayDate = (value) => {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
