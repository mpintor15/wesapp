const fs = require('node:fs/promises');
const path = require('node:path');
const { listMigrations } = require('../config/migrations');

describe('database migrations', () => {
  test('have unique versions and are returned in ascending order', async () => {
    const migrations = await listMigrations();
    const versions = migrations.map((migration) => migration.version);

    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toContain(13);
  });

  test('each migration registers its own schema version', async () => {
    const migrations = await listMigrations();

    for (const migration of migrations) {
      const sql = await fs.readFile(
        path.resolve(__dirname, '../../../database/migrations', migration.fileName),
        'utf8'
      );
      expect(sql).toContain('schema_version');
      expect(sql).toMatch(new RegExp(`\\(${migration.version},\\s*'`));
    }
  });
});
