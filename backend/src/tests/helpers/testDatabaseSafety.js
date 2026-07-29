const TEST_DATABASE_SUFFIX = '_test';
const TEST_RESOURCE_PATTERN = /(^|_)test($|_)/i;

const isSafeTestDatabaseName = (databaseName) => {
  const value = String(databaseName || '').trim();
  return value.endsWith(TEST_DATABASE_SUFFIX) && TEST_RESOURCE_PATTERN.test(value);
};

const assertSafeTestDatabase = (databaseName) => {
  if (process.env.NODE_ENV !== 'test' || !isSafeTestDatabaseName(databaseName)) {
    throw new Error(
      'Unsafe PostgreSQL test configuration: set NODE_ENV=test and DB_NAME to a *_test database'
    );
  }
};

const buildSafeTestResourceName = (prefix) => {
  const safePrefix = String(prefix || '').replace(/[^a-zA-Z0-9_]/g, '_');
  return `${safePrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}${TEST_DATABASE_SUFFIX}`;
};

module.exports = {
  assertSafeTestDatabase,
  buildSafeTestResourceName,
  isSafeTestDatabaseName,
};
