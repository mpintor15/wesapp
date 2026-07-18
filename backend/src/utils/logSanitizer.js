const path = require('node:path');

const MAX_STRING_LENGTH = 600;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_KEYS = 30;
const MAX_DEPTH = 4;

const SENSITIVE_KEY_PATTERN =
  /password|contraseña|token|authorization|cookie|secret|jwt|database_url|db_password|pass|hash/i;
const SQL_PRIVATE_FIELDS = new Set([
  'detail',
  'hint',
  'where',
  'query',
  'text',
  'parameters',
  'params',
  'values',
  'config',
  'connectionParameters',
]);

const truncate = (value, max = MAX_STRING_LENGTH) =>
  value.length > max ? `${value.slice(0, max)}...[truncated]` : value;

const redactSecretsInString = (value) =>
  value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|contraseña|token|secret|jwt)=([^&\s]+)/gi, '$1=[REDACTED]');

const sanitizePathInString = (value, production) => {
  if (!production) {
    return value;
  }

  return value.replace(/(?:\/Users|\/home|\/private|\/var|\/tmp)\/[^\s"'`),;]+/g, (match) =>
    path.basename(match)
  );
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

const sanitizeValue = (
  value,
  {
    includeStack = process.env.NODE_ENV !== 'production',
    production = process.env.NODE_ENV === 'production',
    depth = 0,
    seen = new WeakSet(),
    key = '',
  } = {}
) => {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncate(sanitizePathInString(redactSecretsInString(value), production));
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  if (depth >= MAX_DEPTH) {
    return '[MaxDepth]';
  }

  seen.add(value);

  if (value instanceof Error) {
    return sanitizeError(value, { includeStack, production, seen, depth });
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, { includeStack, production, depth: depth + 1, seen }));
  }

  if (!isPlainObject(value)) {
    return truncate(sanitizePathInString(String(value), production));
  }

  const result = {};
  const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
  for (const [entryKey, entryValue] of entries) {
    if (SENSITIVE_KEY_PATTERN.test(entryKey)) {
      result[entryKey] = '[REDACTED]';
      continue;
    }
    if (production && SQL_PRIVATE_FIELDS.has(entryKey)) {
      continue;
    }
    if (production && entryKey === 'stack') {
      continue;
    }
    result[entryKey] = sanitizeValue(entryValue, {
      includeStack,
      production,
      depth: depth + 1,
      seen,
      key: entryKey,
    });
  }

  return result;
};

const sanitizeError = (
  error,
  {
    includeStack = process.env.NODE_ENV !== 'production',
    production = process.env.NODE_ENV === 'production',
    seen = new WeakSet(),
    depth = 0,
  } = {}
) => {
  if (!error) {
    return {};
  }

  const output = {
    message: sanitizeValue(error.message || 'Error', { includeStack, production, seen }),
    name: error.name,
  };

  if (error.code) {
    output.code = sanitizeValue(error.code, { includeStack, production, seen });
  }
  if (error.appCode) {
    output.appCode = sanitizeValue(error.appCode, { includeStack, production, seen });
  }
  if (error.status) {
    output.status = error.status;
  }
  if (error.severity && !production) {
    output.severity = sanitizeValue(error.severity, { seen });
  }
  if (includeStack && error.stack) {
    output.stack = sanitizeValue(error.stack, { includeStack, production, seen });
  }

  if (!production && depth < MAX_DEPTH) {
    for (const [key, value] of Object.entries(error)) {
      if (key in output || SQL_PRIVATE_FIELDS.has(key)) {
        continue;
      }
      output[key] = sanitizeValue(value, {
        includeStack,
        production,
        depth: depth + 1,
        seen,
        key,
      });
    }
  }

  return output;
};

const sanitizeLogMetadata = (metadata, options = {}) => sanitizeValue(metadata, options);

module.exports = {
  sanitizeError,
  sanitizeLogMetadata,
  sanitizeValue,
};
