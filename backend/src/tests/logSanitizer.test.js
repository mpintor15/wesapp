const { sanitizeError, sanitizeLogMetadata } = require('../utils/logSanitizer');

describe('logSanitizer', () => {
  test('incluye stack en desarrollo cuando corresponde', () => {
    const error = new Error('fallo de desarrollo');
    const sanitized = sanitizeError(error, { includeStack: true, production: false });

    expect(sanitized.message).toBe('fallo de desarrollo');
    expect(sanitized.stack).toEqual(expect.stringContaining('fallo de desarrollo'));
  });

  test('omite stack, detalle SQL y parámetros en producción', () => {
    const error = new Error('duplicate key value violates unique constraint');
    error.code = '23505';
    error.detail = 'Key (identificacion)=(0999999999) already exists.';
    error.query = 'INSERT INTO clientes(nombre, identificacion) VALUES($1, $2)';
    error.parameters = ['Cliente Privado', '0999999999'];
    error.stack = '/Users/mpinto15/Documents/wesapp/backend/src/config/database.js:99';

    const sanitized = sanitizeError(error, { includeStack: false, production: true });

    expect(sanitized).toMatchObject({
      message: 'duplicate key value violates unique constraint',
      code: '23505',
      name: 'Error',
    });
    expect(JSON.stringify(sanitized)).not.toMatch(
      /identificacion|0999999999|Cliente Privado|INSERT INTO|parameters|stack|\/Users/i
    );
  });

  test('redacta token, authorization, cookie y password', () => {
    const metadata = sanitizeLogMetadata(
      {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret.part',
        cookie: 'session=abc',
        password: 'clave-secreta',
        message: 'token=abc123 password=abc123',
      },
      { production: true, includeStack: false }
    );

    expect(JSON.stringify(metadata)).not.toMatch(/eyJ|session=abc|clave-secreta|abc123/);
    expect(metadata.authorization).toBe('[REDACTED]');
    expect(metadata.cookie).toBe('[REDACTED]');
    expect(metadata.password).toBe('[REDACTED]');
  });

  test('no falla con objetos circulares', () => {
    const metadata = { code: 'TEST' };
    metadata.self = metadata;

    expect(() =>
      sanitizeLogMetadata(metadata, { production: true, includeStack: false })
    ).not.toThrow();
    expect(sanitizeLogMetadata(metadata, { production: true, includeStack: false }).self).toBe(
      '[Circular]'
    );
  });

  test('limita mensajes largos y rutas absolutas en producción', () => {
    const metadata = sanitizeLogMetadata(
      {
        message: `${'x'.repeat(800)} /Users/mpinto15/Documents/wesapp/backend/src/server.js`,
      },
      { production: true, includeStack: false }
    );

    expect(metadata.message).toContain('[truncated]');
    expect(metadata.message).not.toContain('/Users/mpinto15/Documents');
  });

  test('preserva códigos técnicos permitidos', () => {
    const error = new Error('conflicto');
    error.code = '23505';
    error.appCode = 'MOVEMENT_PDF_NOT_AVAILABLE';
    error.status = 409;

    expect(sanitizeError(error, { production: true, includeStack: false })).toMatchObject({
      code: '23505',
      appCode: 'MOVEMENT_PDF_NOT_AVAILABLE',
      status: 409,
    });
  });
});
