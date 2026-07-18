const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { listMigrations } = require('../config/migrations');

const projectRoot = path.resolve(__dirname, '../../..');
const migrationsDir = path.resolve(projectRoot, 'database/migrations');
const schemaPath = path.resolve(projectRoot, 'database/schema.sql');

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;

const adminConfig = () => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

const createAdminPool = () => new Pool(adminConfig());
const createDbPool = (database) => new Pool({ ...adminConfig(), database });

const withTempDatabase = async (prefix, callback) => {
  const database = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const admin = createAdminPool();
  await admin.query(`CREATE DATABASE ${quoteIdent(database)}`);
  await admin.end();

  const pool = createDbPool(database);
  try {
    await callback(pool);
  } finally {
    await pool.end();
    const cleanup = createAdminPool();
    await cleanup.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`);
    await cleanup.end();
  }
};

const readMigration = async (version) => {
  const migrations = await listMigrations();
  const migration = migrations.find((item) => item.version === version);
  if (!migration) {
    throw new Error(`Migration ${version} not found`);
  }
  return fs.readFile(path.join(migrationsDir, migration.fileName), 'utf8');
};

const applyPendingMigrations = async (pool) => {
  const migrations = await listMigrations();
  const appliedResult = await pool.query('SELECT version FROM schema_version');
  const applied = new Set(appliedResult.rows.map((row) => Number(row.version)));

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, migration.fileName), 'utf8');
    await pool.query(sql);
    applied.add(migration.version);
  }
};

const createPre015OriginalSchema = async (pool) => {
  await pool.query(`
    CREATE TABLE usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT,
      tipo_usuario TEXT
    );
    CREATE TABLE ubicaciones (
      id SERIAL PRIMARY KEY,
      nombre TEXT
    );
    CREATE TABLE articulos (
      id SERIAL PRIMARY KEY,
      tipo_articulo TEXT,
      nombre_articulo TEXT,
      cantidad INTEGER DEFAULT 1,
      activo BOOLEAN DEFAULT TRUE,
      ubicacion_id INTEGER REFERENCES ubicaciones(id)
    );
    CREATE TABLE movimientos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      pdf_path TEXT,
      estado VARCHAR(20) DEFAULT 'ACTIVO',
      anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      anulado_en TIMESTAMP,
      motivo_anulacion TEXT,
      eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      eliminado_en TIMESTAMP,
      motivo_eliminacion TEXT,
      CONSTRAINT chk_movimientos_estado CHECK (estado IN ('ACTIVO', 'ANULADO', 'ELIMINADO'))
    );
    CREATE TABLE detalle_movimientos (
      id SERIAL PRIMARY KEY,
      movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE,
      articulo_id INTEGER REFERENCES articulos(id),
      cantidad INTEGER DEFAULT 1 CHECK (cantidad > 0),
      ubicacion_origen_id INTEGER REFERENCES ubicaciones(id),
      ubicacion_destino_id INTEGER REFERENCES ubicaciones(id)
    );
    CREATE TABLE articulos_bajas (
      id SERIAL PRIMARY KEY,
      articulo_id INTEGER REFERENCES articulos(id) ON DELETE SET NULL,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      motivo TEXT NOT NULL,
      fecha_baja TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tipo_articulo TEXT,
      nombre_articulo TEXT,
      ubicacion_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
      ubicacion_nombre TEXT,
      estado VARCHAR(20) DEFAULT 'ACTIVO',
      anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      anulado_en TIMESTAMP,
      motivo_anulacion TEXT,
      eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      eliminado_en TIMESTAMP,
      motivo_eliminacion TEXT,
      CONSTRAINT chk_articulos_bajas_estado CHECK (estado IN ('ACTIVO', 'ANULADO', 'ELIMINADO'))
    );
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO schema_version (version, description)
    SELECT version, 'already applied'
    FROM generate_series(2, 15) AS version;
    INSERT INTO usuarios (usuario, tipo_usuario) VALUES ('gerente', 'gerente');
    INSERT INTO ubicaciones (nombre) VALUES ('Bodega');
    INSERT INTO articulos (tipo_articulo, nombre_articulo, cantidad, ubicacion_id)
    VALUES ('equipo', 'Chaleco', 5, 1);
    INSERT INTO articulos_bajas (articulo_id, usuario_id, cantidad, motivo, ubicacion_id)
    VALUES (1, 1, 2, 'Baja historica inequivoca', 1);
    INSERT INTO movimientos (usuario_id) VALUES (1);
    INSERT INTO detalle_movimientos (movimiento_id, articulo_id, cantidad, ubicacion_origen_id)
    VALUES (1, 1, 1, 1);
  `);
};

const expectStockEffectsModel = async (pool) => {
  const table = await pool.query(
    'SELECT to_regclass($$public.inventario_stock_efectos$$) AS table'
  );
  expect(table.rows[0].table).toBe('inventario_stock_efectos');

  const columns = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventario_stock_efectos'
  `);
  const columnMap = new Map(columns.rows.map((row) => [row.column_name, row]));
  expect(columnMap.get('articulo_id')).toMatchObject({
    data_type: 'integer',
    is_nullable: 'NO',
  });
  expect(columnMap.get('delta')).toMatchObject({ data_type: 'integer', is_nullable: 'NO' });

  const constraints = await pool.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.inventario_stock_efectos'::regclass
  `);
  const constraintNames = constraints.rows.map((row) => row.conname);
  expect(constraintNames).toContain('chk_inventario_stock_efectos_owner');
  expect(constraintNames).toContain('chk_inventario_stock_efectos_change');

  const foreignKeys = await pool.query(`
    SELECT a.attname AS column_name, c.confrelid::regclass::text AS target_table
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.inventario_stock_efectos'::regclass
      AND c.contype = 'f'
  `);
  const fkMap = new Map(foreignKeys.rows.map((row) => [row.column_name, row.target_table]));
  expect(fkMap.get('movimiento_id')).toBe('movimientos');
  expect(fkMap.get('baja_id')).toBe('articulos_bajas');
  expect(fkMap.get('articulo_id')).toBe('articulos');

  const indexes = await pool.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'inventario_stock_efectos'
  `);
  const indexNames = indexes.rows.map((row) => row.indexname);
  expect(indexNames).toContain('idx_inventario_stock_efectos_movimiento');
  expect(indexNames).toContain('idx_inventario_stock_efectos_baja');
  expect(indexNames).toContain('idx_inventario_stock_efectos_articulo');
};

describe('database migrations', () => {
  test('have unique versions and are returned in ascending order', async () => {
    const migrations = await listMigrations();
    const versions = migrations.map((migration) => migration.version);

    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toContain(13);
    expect(versions).toContain(16);
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

  test('inventory integrity migration prevalidates negative stock before constraints', async () => {
    const sql = await fs.readFile(
      path.resolve(
        __dirname,
        '../../../database/migrations/015_inventory_transaction_integrity.sql'
      ),
      'utf8'
    );

    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM articulos WHERE cantidad < 0\)/);
    expect(sql).toMatch(/RAISE EXCEPTION 'No se puede agregar chk_articulos_cantidad_non_negative/);
    expect(sql).not.toMatch(/UPDATE articulos\s+SET cantidad = 0/i);
  });

  test('inventory integrity migration 015 does not contain stock effects drift', async () => {
    const sql = await fs.readFile(
      path.resolve(migrationsDir, '015_inventory_transaction_integrity.sql'),
      'utf8'
    );

    expect(sql).not.toContain('inventario_stock_efectos');
    expect(sql).not.toContain('reversion_datos_completos');
  });

  test('inventory stock effects migration creates exact effects without ambiguous movement backfill', async () => {
    const sql = await readMigration(16);

    expect(sql).toContain('CREATE TABLE inventario_stock_efectos');
    expect(sql).toContain('articulo_id INTEGER NOT NULL REFERENCES articulos(id)');
    expect(sql).toContain('UPDATE articulos_bajas b');
    expect(sql).toContain('inventario_stock_efectos existe con columnas incompatibles');
    expect(sql).not.toMatch(/UPDATE movimientos\s+m\s+SET reversion_datos_completos = TRUE/i);
  });

  test('scenario A: fresh schema has stock effects model and schema version 16', async () => {
    await withTempDatabase('wesapp_migration_fresh', async (pool) => {
      const schemaSql = await fs.readFile(schemaPath, 'utf8');
      await pool.query(schemaSql);

      await expectStockEffectsModel(pool);
      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 16');
      expect(version.rowCount).toBe(1);
    });
  });

  test('scenario B: database with original 015 applied receives 016 safely', async () => {
    await withTempDatabase('wesapp_migration_from_015', async (pool) => {
      await createPre015OriginalSchema(pool);

      await applyPendingMigrations(pool);

      await expectStockEffectsModel(pool);
      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 16');
      expect(version.rowCount).toBe(1);

      const bajas = await pool.query(
        'SELECT COUNT(*)::int AS total FROM articulos_bajas WHERE reversion_datos_completos = TRUE'
      );
      expect(bajas.rows[0].total).toBe(1);

      const movimientos = await pool.query(
        'SELECT COUNT(*)::int AS total FROM movimientos WHERE reversion_datos_completos = TRUE'
      );
      expect(movimientos.rows[0].total).toBe(0);

      await pool.query(
        `INSERT INTO inventario_stock_efectos (
          movimiento_id,
          articulo_id,
          delta,
          stock_anterior,
          stock_posterior,
          ubicacion_anterior_id,
          ubicacion_posterior_id
        ) VALUES (1, 1, -1, 5, 4, 1, 1)`
      );
    });
  });

  test('scenario C: existing correct stock effects table is accepted idempotently', async () => {
    await withTempDatabase('wesapp_migration_divergent_ok', async (pool) => {
      await createPre015OriginalSchema(pool);
      const sql = await readMigration(16);
      await pool.query(sql);
      await pool.query('DELETE FROM schema_version WHERE version = 16');

      await applyPendingMigrations(pool);

      await expectStockEffectsModel(pool);
      const effects = await pool.query(
        'SELECT COUNT(*)::int AS total FROM inventario_stock_efectos WHERE baja_id = 1'
      );
      expect(effects.rows[0].total).toBe(1);
    });
  });

  test('scenario D: incompatible stock effects table fails without partial migration', async () => {
    await withTempDatabase('wesapp_migration_bad_effects', async (pool) => {
      await createPre015OriginalSchema(pool);
      await pool.query(`
        CREATE TABLE inventario_stock_efectos (
          id SERIAL PRIMARY KEY,
          articulo_id TEXT
        )
      `);

      await expect(applyPendingMigrations(pool)).rejects.toThrow(/columnas incompatibles/);

      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 16');
      expect(version.rowCount).toBe(0);

      const columns = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'movimientos'
          AND column_name = 'reversion_datos_completos'
      `);
      expect(columns.rowCount).toBe(0);
    });
  });
});
