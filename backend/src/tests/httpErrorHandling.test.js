jest.mock('../config/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

const logger = require('../config/logger');
const { handleControllerError } = require('../utils/http');

const createResponse = () => {
  const res = {
    headersSent: false,
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('HTTP error handling', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('sanitizes sensitive error metadata before logging controller failures', () => {
    const error = new Error(
      'password=secret-token failed at /Users/mpinto15/Documents/wesapp/backend/src/db.js'
    );
    error.status = 500;
    error.code = 'XX000';
    error.authorization = 'Bearer eyJhbGciOiJIUzI1NiJ9.secret.part';
    error.stack =
      'Error: password=secret-token\n    at /Users/mpinto15/Documents/wesapp/backend/src/db.js:10';
    error.query = 'SELECT * FROM usuarios WHERE password_hash = $1';
    error.parameters = ['secret-token'];

    handleControllerError(createResponse(), error, 'Error controlado:');

    const metadata = logger.error.mock.calls[0][1];
    expect(JSON.stringify(metadata)).not.toMatch(
      /secret-token|eyJ|password_hash|SELECT \*|parameters|\/Users\/mpinto15/
    );
    expect(metadata).toMatchObject({
      status: 500,
      error: expect.objectContaining({ code: 'XX000' }),
    });
  });
});
