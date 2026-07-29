const {
  assertSafeTestDatabase,
  buildSafeTestResourceName,
  isSafeTestDatabaseName,
} = require('./helpers/testDatabaseSafety');

describe('PostgreSQL test database safety', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('requires NODE_ENV=test and a *_test database for destructive tests', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertSafeTestDatabase('wesapp_test')).toThrow(/Unsafe PostgreSQL/);

    process.env.NODE_ENV = 'test';
    expect(() => assertSafeTestDatabase('wesapp')).toThrow(/Unsafe PostgreSQL/);
    expect(() => assertSafeTestDatabase('production')).toThrow(/Unsafe PostgreSQL/);
    expect(() => assertSafeTestDatabase('wesapp_test')).not.toThrow();
  });

  test('builds temporary resource names that remain visibly disposable', () => {
    const resourceName = buildSafeTestResourceName('wesapp_migration');

    expect(resourceName).toMatch(/^wesapp_migration_\d+_\d+_test$/);
    expect(isSafeTestDatabaseName(resourceName)).toBe(true);
  });
});
