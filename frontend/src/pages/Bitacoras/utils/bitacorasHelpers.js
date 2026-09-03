const padTwoDigits = (value) => String(value).padStart(2, '0');

const LOCAL_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/;
const UTC_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

export const getLocalDateTimeValue = (date = new Date()) =>
  `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(
    date.getDate()
  )}T${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`;

export const normalizeLocalDateTimeForPayload = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return LOCAL_TIMESTAMP_PATTERN.test(normalized) ? normalized : '';
};

const getFormattedParts = (date, timeZone) => {
  const parts = new globalThis.Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.day}/${byType.month}/${byType.year} ${byType.hour}:${byType.minute}`;
};

export const formatLocalTimestamp = (value, { timeZone } = {}) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const localMatch = LOCAL_TIMESTAMP_PATTERN.exec(normalized);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const utcMatch = UTC_TIMESTAMP_PATTERN.exec(normalized);
  if (!utcMatch) return '';

  const [, year, month, day, hour, minute, second, milliseconds = '0'] = utcMatch;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(milliseconds.padEnd(3, '0'))
    )
  );
  return getFormattedParts(date, timeZone);
};
