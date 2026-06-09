const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('./database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');
const MIGRATION_FILE_PATTERN = /^(\d+)_.*\.sql$/;
const MIGRATION_LOCK_ID = 937461205;

const listMigrations = async () => {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .map((fileName) => {
      const match = fileName.match(MIGRATION_FILE_PATTERN);
      return match ? { version: Number(match[1]), fileName } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
};

const runMigrations = async () => {
  const client = await db.getClient();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const appliedResult = await client.query('SELECT version FROM schema_version');
    const appliedVersions = new Set(appliedResult.rows.map((row) => Number(row.version)));
    const migrations = await listMigrations();

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, migration.fileName), 'utf8');
      console.log(`Aplicando migración ${migration.fileName}...`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        const versionResult = await client.query(
          'SELECT 1 FROM schema_version WHERE version = $1',
          [migration.version]
        );
        if (versionResult.rowCount === 0) {
          throw new Error(`La migración ${migration.fileName} no registró su versión`);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      appliedVersions.add(migration.version);
      console.log(`Migración ${migration.fileName} aplicada`);
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
    }
  }
};

module.exports = { listMigrations, runMigrations };
