const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { listMigrations } = require('../config/migrations');
const {
  assertSafeTestDatabase,
  buildSafeTestResourceName,
} = require('./helpers/testDatabaseSafety');

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
  assertSafeTestDatabase(process.env.DB_NAME);
  const database = buildSafeTestResourceName(prefix);
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

const normalizeSqlWhitespace = (sql) => sql.replace(/\s+/g, ' ').trim();

const hasSchemaVersionRegistration = (sql, version) => {
  const normalized = normalizeSqlWhitespace(sql);
  const versionTuple = String.raw`\(\s*${version}\s*,\s*'[^']+'\s*\)`;
  const pattern = new RegExp(
    String.raw`\bINSERT\s+INTO\s+schema_version\s*\(\s*version\s*,\s*description\s*\)\s+VALUES\b.*${versionTuple}`,
    'i'
  );

  return pattern.test(normalized);
};

const hasDropUbicacionesNombreConstraint = (sql) => {
  const normalized = normalizeSqlWhitespace(sql);
  return /\bALTER\s+TABLE\s+ubicaciones\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+ubicaciones_nombre_key\b/i.test(
    normalized
  );
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

const applyMigrationInTransaction = async (pool, version) => {
  const sql = await readMigration(version);
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
};

const createPre015OriginalSchema = async (pool) => {
  await pool.query(`
    CREATE TABLE usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT,
      tipo_usuario TEXT
    );
    CREATE TABLE colaboradores (
      id SERIAL PRIMARY KEY
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
      talla TEXT,
      marca TEXT,
      modelo TEXT,
      numero_serie TEXT,
      calibre TEXT,
      fecha_caducidad DATE,
      codigo_pantalla TEXT,
      codigo_radio TEXT,
      version TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

const createPre018ClientesSchema = async (pool, { duplicatedIdentification = false } = {}) => {
  await pool.query(`
    CREATE TABLE clientes (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      identificacion TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cuentas (
      num_factura INTEGER PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      fecha_factura DATE NOT NULL,
      valor_factura NUMERIC(10,2) NOT NULL CHECK (valor_factura > 0),
      incluye_iva BOOLEAN DEFAULT FALSE,
      incluye_retencion_fuente BOOLEAN DEFAULT FALSE,
      incluye_retencion_iva BOOLEAN DEFAULT FALSE,
      cancelada BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO schema_version (version, description)
    SELECT version, 'already applied'
    FROM generate_series(2, 17) AS version;
  `);

  if (duplicatedIdentification) {
    await pool.query(`
      INSERT INTO clientes (nombre, identificacion)
      VALUES ('Cliente Uno', 'ABC-001'), ('Cliente Dos', ' abc-001 ');
    `);
  } else {
    await pool.query(`
      INSERT INTO clientes (nombre, identificacion)
      VALUES
        ('Cliente Historico', '  ABC-001  '),
        ('Cliente Identificacion Vacia', ''),
        ('Cliente Facturado', 'FAC-001');
      INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura)
      VALUES (1001, 3, '2026-01-10', 150.00);
    `);
  }
};

const createPre019UbicacionesSchema = async (pool) => {
  await pool.query(`
    CREATE TABLE clientes (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      identificacion TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo'
    );
    CREATE TABLE cuentas (
      num_factura INTEGER PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      fecha_factura DATE NOT NULL,
      valor_factura NUMERIC(10,2) NOT NULL CHECK (valor_factura > 0)
    );
    CREATE TABLE pagos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      fecha DATE NOT NULL,
      metodo_pago TEXT,
      total NUMERIC(10,2) NOT NULL
    );
    CREATE TABLE ubicaciones (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) UNIQUE NOT NULL
    );
    CREATE TABLE articulos (
      id SERIAL PRIMARY KEY,
      tipo_articulo TEXT,
      nombre_articulo TEXT,
      cantidad INTEGER DEFAULT 1,
      talla TEXT,
      marca TEXT,
      modelo TEXT,
      numero_serie TEXT,
      calibre TEXT,
      fecha_caducidad DATE,
      codigo_pantalla TEXT,
      codigo_radio TEXT,
      version TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      activo BOOLEAN DEFAULT TRUE,
      ubicacion_id INTEGER REFERENCES ubicaciones(id)
    );
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX idx_ubicaciones_nombre_lower_unique
      ON ubicaciones (LOWER(TRIM(nombre)));
    INSERT INTO schema_version (version, description)
    SELECT version, 'already applied'
    FROM generate_series(2, 18) AS version;
    INSERT INTO clientes (nombre, identificacion)
    VALUES ('Cliente Norte', 'NORTE'), ('Cliente Sur', 'SUR');
    INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura)
    VALUES (1001, 1, '2026-01-01', 200.00);
    INSERT INTO pagos (cliente_id, fecha, metodo_pago, total)
    VALUES (2, '2026-01-02', 'transferencia', 50.00);
    INSERT INTO ubicaciones (nombre)
    VALUES ('Bodega Norte'), ('Bodega Sur');
    INSERT INTO articulos (tipo_articulo, nombre_articulo, cantidad, ubicacion_id)
    VALUES ('equipo', 'Chaleco', 2, 1);
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

const expectUbicacionesClienteModel = async (pool) => {
  const columns = await pool.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ubicaciones'
  `);
  const columnMap = new Map(columns.rows.map((row) => [row.column_name, row]));
  expect(columnMap.get('cliente_id')).toMatchObject({ is_nullable: 'YES' });

  const foreignKeys = await pool.query(`
    SELECT conname, confdeltype
    FROM pg_constraint
    WHERE conrelid = 'public.ubicaciones'::regclass
      AND contype = 'f'
      AND conname = 'fk_ubicaciones_cliente'
  `);
  expect(foreignKeys.rowCount).toBe(1);
  expect(foreignKeys.rows[0].confdeltype).toBe('r');

  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ubicaciones'
  `);
  const indexMap = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef]));

  expect(indexMap.has('idx_ubicaciones_nombre_lower_unique')).toBe(false);
  expect(indexMap.get('idx_ubicaciones_cliente_id')).toContain('cliente_id');
  expect(indexMap.get('idx_ubicaciones_cliente_nombre_lower_unique')).toMatch(
    /cliente_id, lower\(TRIM\(BOTH FROM nombre\)\)/i
  );
  expect(indexMap.get('idx_ubicaciones_cliente_nombre_lower_unique')).toMatch(
    /WHERE \(cliente_id IS NOT NULL\)/i
  );
};

const expectClientesCatalogModel = async (pool) => {
  const table = await pool.query('SELECT to_regclass($$public.clientes$$) AS table');
  expect(table.rows[0].table).toBe('clientes');

  const columns = await pool.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
  `);
  const columnMap = new Map(columns.rows.map((row) => [row.column_name, row]));
  expect(columnMap.get('nombre')).toMatchObject({ is_nullable: 'NO' });
  expect(columnMap.get('identificacion')).toMatchObject({ is_nullable: 'YES' });
  expect(columnMap.get('tipo_identificacion')).toBeDefined();
  expect(columnMap.get('telefono')).toBeDefined();
  expect(columnMap.get('correo')).toBeDefined();
  expect(columnMap.get('direccion')).toBeDefined();
  expect(columnMap.get('ciudad')).toBeDefined();
  expect(columnMap.get('estado')).toMatchObject({ is_nullable: 'NO' });

  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'clientes'
  `);
  const indexMap = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef]));
  expect(indexMap.get('idx_clientes_nombre_normalizado')).toMatch(
    /lower\(TRIM\(BOTH FROM nombre\)\)/i
  );
  expect(indexMap.get('idx_clientes_estado')).toContain('estado');
  expect(indexMap.get('idx_clientes_identificacion_normalizada_unique')).toMatch(
    /lower\(TRIM\(BOTH FROM identificacion\)\)/i
  );
};

describe('database migrations', () => {
  test('have unique versions and are returned in ascending order', async () => {
    const migrations = await listMigrations();
    const versions = migrations.map((migration) => migration.version);

    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toContain(13);
    expect(versions).toContain(18);
    expect(versions).toContain(19);
  });

  test('schema version registration matcher is strict but whitespace tolerant', () => {
    const descriptionLiteral = [
      String.fromCharCode(39),
      'Description',
      String.fromCharCode(39),
    ].join('');

    expect(
      hasSchemaVersionRegistration(
        'INSERT INTO schema_version (version, description) VALUES (19, ' + descriptionLiteral + ')',
        19
      )
    ).toBe(true);
    expect(
      hasSchemaVersionRegistration(
        `
          INSERT INTO schema_version (
            version,
            description
          )
          VALUES (
            19,
            'Description'
          )
        `,
        19
      )
    ).toBe(true);
    expect(
      hasSchemaVersionRegistration(
        'INSERT  INTO  schema_version  ( version , description )  VALUES  ( 19 , ' +
          descriptionLiteral +
          ' )',
        19
      )
    ).toBe(true);

    expect(
      hasSchemaVersionRegistration(
        'INSERT INTO schema_version (version, description) VALUES (18, ' + descriptionLiteral + ')',
        19
      )
    ).toBe(false);
    expect(
      hasSchemaVersionRegistration(
        'INSERT INTO schema_version (version, description) VALUES (19, NULL)',
        19
      )
    ).toBe(false);
  });

  test('ubicaciones constraint drop matcher is strict but whitespace tolerant', () => {
    expect(
      hasDropUbicacionesNombreConstraint(
        'ALTER TABLE ubicaciones DROP CONSTRAINT IF EXISTS ubicaciones_nombre_key'
      )
    ).toBe(true);
    expect(
      hasDropUbicacionesNombreConstraint(`
        ALTER TABLE ubicaciones
          DROP CONSTRAINT IF EXISTS ubicaciones_nombre_key
      `)
    ).toBe(true);
    expect(
      hasDropUbicacionesNombreConstraint(
        'ALTER   TABLE   ubicaciones   DROP   CONSTRAINT   IF   EXISTS   ubicaciones_nombre_key'
      )
    ).toBe(true);

    expect(
      hasDropUbicacionesNombreConstraint(
        'ALTER TABLE ubicaciones DROP CONSTRAINT IF EXISTS otra_constraint'
      )
    ).toBe(false);
    expect(hasDropUbicacionesNombreConstraint('SELECT 1')).toBe(false);
  });

  test('each migration registers its own schema version', async () => {
    const migrations = await listMigrations();

    for (const migration of migrations) {
      const sql = await fs.readFile(
        path.resolve(__dirname, '../../../database/migrations', migration.fileName),
        'utf8'
      );
      expect(sql).toContain('schema_version');
      expect(hasSchemaVersionRegistration(sql, migration.version)).toBe(true);
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

  test('ubicaciones migration enforces case-insensitive unique names safely', async () => {
    const sql = await readMigration(17);

    expect(sql).toContain('LOCK TABLE ubicaciones IN SHARE ROW EXCLUSIVE MODE');
    expect(sql).toContain('LOWER(TRIM(nombre))');
    expect(sql).toContain('HAVING COUNT(*) > 1');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_nombre_lower_unique');
    expect(sql).toContain('ubicaciones_duplicate_diagnostics.sql');
    expect(sql).toMatch(/VALUES \(17, 'Case-insensitive unique normalized locations'\)/);
  });

  test('clientes migration prepares catalog fields and normalized identification uniqueness', async () => {
    const sql = await readMigration(18);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS clientes');
    expect(sql).toContain('LOWER(TRIM(identificacion))');
    expect(sql).toContain('HAVING COUNT(*) > 1');
    expect(sql).toContain('idx_clientes_identificacion_normalizada_unique');
    expect(sql).toMatch(/VALUES \(18, 'Clientes catalog normalization'\)/);
    expect(sql).not.toMatch(/DELETE FROM clientes/i);
    expect(sql).not.toMatch(/nombre\s*=\s*TRIM\(nombre\)/i);
    expect(sql).not.toMatch(/correo\s*=\s*NULLIF/i);
  });

  test('ubicaciones-clientes migration keeps historical locations nullable and scopes uniqueness by client', async () => {
    const sql = await readMigration(19);
    const normalizedSql = normalizeSqlWhitespace(sql);

    expect(hasSchemaVersionRegistration(sql, 19)).toBe(true);
    expect(normalizedSql).toContain('ADD COLUMN IF NOT EXISTS cliente_id INTEGER NULL');
    expect(hasDropUbicacionesNombreConstraint(sql)).toBe(true);
    expect(normalizedSql).toContain('FOREIGN KEY (cliente_id)');
    expect(normalizedSql).toMatch(
      /\bDROP INDEX IF EXISTS (public\.)?idx_ubicaciones_nombre_lower_unique\b/i
    );
    expect(normalizedSql).toContain('idx_ubicaciones_cliente_nombre_lower_unique');
    expect(normalizedSql).toMatch(/WHERE cliente_id IS NOT NULL/i);
    expect(sql).not.toMatch(/UPDATE ubicaciones\s+SET cliente_id/i);
    expect(sql).not.toMatch(/cliente_id\s+INTEGER\s+NOT NULL/i);

    await withTempDatabase('wesapp_migration_ubicaciones_019', async (pool) => {
      await createPre019UbicacionesSchema(pool);

      await applyMigrationInTransaction(pool, 19);
      await expectUbicacionesClienteModel(pool);

      const historicas = await pool.query(
        'SELECT COUNT(*)::int AS total FROM ubicaciones WHERE cliente_id IS NULL'
      );
      expect(historicas.rows[0].total).toBe(2);

      await pool.query('INSERT INTO clientes (nombre, identificacion) VALUES ($1, $2)', [
        'Cliente Norte',
        'NORTE-2',
      ]);

      await pool.query('UPDATE ubicaciones SET cliente_id = 1 WHERE id = 1');
      await pool.query('UPDATE ubicaciones SET cliente_id = 2 WHERE id = 2');
      await pool.query('INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2)', [
        'Bodega Norte',
        2,
      ]);
      await expect(
        pool.query('INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2)', [
          ' bodega norte ',
          1,
        ])
      ).rejects.toMatchObject({ code: '23505' });

      await expect(pool.query('DELETE FROM clientes WHERE id = 1')).rejects.toMatchObject({
        code: '23503',
      });

      const factura = await pool.query('SELECT cliente_id FROM cuentas WHERE num_factura = 1001');
      expect(factura.rows[0].cliente_id).toBe(1);

      const pago = await pool.query('SELECT cliente_id FROM pagos WHERE id = 1');
      expect(pago.rows[0].cliente_id).toBe(2);

      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 19');
      expect(version.rowCount).toBe(1);
    });
  });

  test('clientes migration 018 preserves historical cuentas data and allows optional identification', async () => {
    await withTempDatabase('wesapp_migration_clientes_018', async (pool) => {
      await createPre018ClientesSchema(pool);

      await applyMigrationInTransaction(pool, 18);
      await expectClientesCatalogModel(pool);

      const historical = await pool.query(
        `SELECT nombre, identificacion, estado
         FROM clientes
         WHERE nombre = 'Cliente Historico'`
      );
      expect(historical.rows[0]).toMatchObject({
        nombre: 'Cliente Historico',
        identificacion: '  ABC-001  ',
        estado: 'activo',
      });

      const emptyIdentification = await pool.query(
        `SELECT identificacion
         FROM clientes
         WHERE nombre = 'Cliente Identificacion Vacia'`
      );
      expect(emptyIdentification.rows[0].identificacion).toBeNull();

      const factura = await pool.query(
        `SELECT c.num_factura, cl.nombre
         FROM cuentas c
         JOIN clientes cl ON cl.id = c.cliente_id
         WHERE c.num_factura = 1001`
      );
      expect(factura.rows[0]).toEqual({
        num_factura: 1001,
        nombre: 'Cliente Facturado',
      });

      await pool.query('INSERT INTO clientes (nombre, identificacion) VALUES ($1, NULL)', [
        'Sin Ident 1',
      ]);
      await pool.query('INSERT INTO clientes (nombre, identificacion) VALUES ($1, NULL)', [
        'Sin Ident 2',
      ]);
      await expect(
        pool.query('INSERT INTO clientes (nombre, identificacion) VALUES ($1, $2)', [
          'Duplicado',
          'abc-001',
        ])
      ).rejects.toMatchObject({ code: '23505' });

      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 18');
      expect(version.rowCount).toBe(1);
    });
  });

  test('clientes migration 018 fails transactionally when normalized identifications are duplicated', async () => {
    await withTempDatabase('wesapp_migration_clientes_018_dup', async (pool) => {
      await createPre018ClientesSchema(pool, { duplicatedIdentification: true });

      await expect(applyMigrationInTransaction(pool, 18)).rejects.toThrow(
        /identificaciones duplicadas/
      );

      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 18');
      expect(version.rowCount).toBe(0);

      const columns = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clientes'
          AND column_name = 'estado'
      `);
      expect(columns.rowCount).toBe(0);
    });
  });

  test('scenario A: fresh schema has stock effects model and schema version 19', async () => {
    await withTempDatabase('wesapp_migration_fresh', async (pool) => {
      const schemaSql = await fs.readFile(schemaPath, 'utf8');
      await pool.query(schemaSql);

      await expectStockEffectsModel(pool);
      await expectUbicacionesClienteModel(pool);
      await expectClientesCatalogModel(pool);
      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 19');
      expect(version.rowCount).toBe(1);
    });
  });

  test('scenario B: database with original 015 applied receives 016 safely', async () => {
    await withTempDatabase('wesapp_migration_from_015', async (pool) => {
      await createPre015OriginalSchema(pool);

      await applyPendingMigrations(pool);

      await expectStockEffectsModel(pool);
      await expectUbicacionesClienteModel(pool);
      await expectClientesCatalogModel(pool);
      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 19');
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

  test('migration 020 preserves users and accepts all existing and new roles', async () => {
    await withTempDatabase('wesapp_migration_roles_020', async (pool) => {
      await pool.query(`
        CREATE TABLE usuarios (
          id SERIAL PRIMARY KEY,
          usuario TEXT NOT NULL,
          tipo_usuario VARCHAR(20) NOT NULL
            CONSTRAINT usuarios_tipo_usuario_check
            CHECK (tipo_usuario IN ('gerente', 'secretario', 'supervisor', 'contador'))
        );
        CREATE TABLE schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO usuarios (usuario, tipo_usuario) VALUES
          ('g', 'gerente'),
          ('s', 'secretario'),
          ('v', 'supervisor'),
          ('c', 'contador');
      `);

      await applyMigrationInTransaction(pool, 20);

      const existing = await pool.query(
        'SELECT usuario, tipo_usuario FROM usuarios ORDER BY usuario'
      );
      expect(existing.rows).toHaveLength(4);
      await expect(
        pool.query(
          `INSERT INTO usuarios (usuario, tipo_usuario)
           VALUES ('guardia', 'guardia'), ('monitorista', 'monitorista')`
        )
      ).resolves.toBeDefined();
      await expect(
        pool.query(`
          INSERT INTO usuarios (usuario, tipo_usuario)
          VALUES ('otro', 'otro')
        `)
      ).rejects.toMatchObject({ code: '23514' });
      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 20');
      expect(version.rowCount).toBe(1);
    });
  });

  test('migration 021 adds nullable unique restricted colaborador relationship', async () => {
    await withTempDatabase('wesapp_migration_usuario_colaborador_021', async (pool) => {
      await pool.query(`
        CREATE TABLE colaboradores (
          id SERIAL PRIMARY KEY,
          nombres_completos TEXT NOT NULL,
          estado TEXT NOT NULL
        );
        CREATE TABLE usuarios (
          id SERIAL PRIMARY KEY,
          usuario TEXT NOT NULL
        );
        CREATE TABLE schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO colaboradores (nombres_completos, estado)
        VALUES ('Uno', 'activo'), ('Dos', 'activo');
        INSERT INTO usuarios (usuario) VALUES ('sin-vinculo'), ('segundo');
      `);

      await applyMigrationInTransaction(pool, 21);

      const preserved = await pool.query(
        'SELECT COUNT(*)::int AS total FROM usuarios WHERE colaborador_id IS NULL'
      );
      expect(preserved.rows[0].total).toBe(2);
      await pool.query('UPDATE usuarios SET colaborador_id = 1 WHERE id = 1');
      await expect(
        pool.query('UPDATE usuarios SET colaborador_id = 1 WHERE id = 2')
      ).rejects.toMatchObject({ code: '23505' });
      await expect(pool.query('DELETE FROM colaboradores WHERE id = 1')).rejects.toMatchObject({
        code: '23503',
      });
      const version = await pool.query('SELECT 1 FROM schema_version WHERE version = 21');
      expect(version.rowCount).toBe(1);
    });
  });

  test('migration 022 creates unique assignments with cascade and restrict behavior', async () => {
    await withTempDatabase('wesapp_migration_usuario_ubicaciones_022', async (pool) => {
      await pool.query(`
        CREATE TABLE usuarios (id SERIAL PRIMARY KEY);
        CREATE TABLE ubicaciones (id SERIAL PRIMARY KEY);
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY, description TEXT NOT NULL);
        INSERT INTO usuarios DEFAULT VALUES;
        INSERT INTO ubicaciones DEFAULT VALUES;
      `);
      await applyMigrationInTransaction(pool, 22);
      await pool.query('INSERT INTO usuario_ubicaciones (usuario_id, ubicacion_id) VALUES (1, 1)');
      await expect(
        pool.query('INSERT INTO usuario_ubicaciones (usuario_id, ubicacion_id) VALUES (1, 1)')
      ).rejects.toMatchObject({ code: '23505' });
      await expect(pool.query('DELETE FROM ubicaciones WHERE id = 1')).rejects.toMatchObject({
        code: '23503',
      });
      await pool.query('DELETE FROM usuarios WHERE id = 1');
      const assignments = await pool.query('SELECT * FROM usuario_ubicaciones');
      expect(assignments.rowCount).toBe(0);
    });
  });

  test('migration 023 preserves locations as GENERAL and validates point types', async () => {
    await withTempDatabase('wesapp_migration_ubicaciones_tipo_023', async (pool) => {
      await pool.query(`
        CREATE TABLE ubicaciones (id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL);
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY, description TEXT NOT NULL);
        INSERT INTO ubicaciones (nombre) VALUES ('Existente');
      `);
      await applyMigrationInTransaction(pool, 23);
      const existing = await pool.query('SELECT tipo_punto FROM ubicaciones WHERE id = 1');
      expect(existing.rows[0].tipo_punto).toBe('GENERAL');
      await pool.query('INSERT INTO ubicaciones (nombre, tipo_punto) VALUES ($1, $2)', [
        'Urb',
        'URBANIZACION',
      ]);
      await expect(
        pool.query('INSERT INTO ubicaciones (nombre, tipo_punto) VALUES ($1, $2)', [
          'Inválida',
          'OTRO',
        ])
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  test('migration 024 enforces normalized uniqueness and historical RESTRICT relationships', async () => {
    await withTempDatabase('wesapp_migration_manzanas_villas_024', async (pool) => {
      await pool.query(`
        CREATE TABLE usuarios (id SERIAL PRIMARY KEY);
        CREATE TABLE ubicaciones (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          tipo_punto VARCHAR(20) NOT NULL DEFAULT 'GENERAL'
        );
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY, description TEXT NOT NULL);
        CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
        $$ LANGUAGE plpgsql;
        INSERT INTO usuarios DEFAULT VALUES;
        INSERT INTO ubicaciones (nombre, tipo_punto)
        VALUES ('Urb', 'URBANIZACION'), ('General', 'GENERAL');
      `);
      await applyMigrationInTransaction(pool, 24);
      await expect(
        pool.query('INSERT INTO manzanas (ubicacion_id, nombre) VALUES ($1, $2)', [2, 'A'])
      ).rejects.toMatchObject({ code: '23514' });
      const manzana = await pool.query(
        `INSERT INTO manzanas (ubicacion_id, nombre, created_by)
         VALUES (1, 'Etapa A', 1) RETURNING id`
      );
      await expect(
        pool.query('INSERT INTO manzanas (ubicacion_id, nombre) VALUES ($1, $2)', [
          1,
          '  etapa   a ',
        ])
      ).rejects.toMatchObject({ code: '23505' });
      await pool.query('INSERT INTO villas (manzana_id, identificador) VALUES ($1, $2)', [
        manzana.rows[0].id,
        'Villa 1',
      ]);
      await expect(
        pool.query('INSERT INTO villas (manzana_id, identificador) VALUES ($1, $2)', [
          manzana.rows[0].id,
          ' villa   1 ',
        ])
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        pool.query('DELETE FROM manzanas WHERE id = $1', [manzana.rows[0].id])
      ).rejects.toMatchObject({
        code: '23503',
      });
      await expect(pool.query('DELETE FROM ubicaciones WHERE id = 1')).rejects.toMatchObject({
        code: '23503',
      });
      await expect(
        pool.query('UPDATE ubicaciones SET tipo_punto = $1 WHERE id = $2', ['GENERAL', 1])
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  test('migration 025 enforces one active principal, active chain and historical RESTRICT', async () => {
    await withTempDatabase('wesapp_migration_residentes_025', async (pool) => {
      await pool.query(`
        CREATE TABLE usuarios (id SERIAL PRIMARY KEY);
        CREATE TABLE ubicaciones (id SERIAL PRIMARY KEY, tipo_punto VARCHAR(20) NOT NULL);
        CREATE TABLE manzanas (
          id SERIAL PRIMARY KEY,
          ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
          estado VARCHAR(10) NOT NULL
        );
        CREATE TABLE villas (
          id SERIAL PRIMARY KEY,
          manzana_id INTEGER NOT NULL REFERENCES manzanas(id) ON DELETE RESTRICT,
          estado VARCHAR(10) NOT NULL
        );
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY, description TEXT NOT NULL);
        INSERT INTO usuarios DEFAULT VALUES;
        INSERT INTO ubicaciones (tipo_punto) VALUES ('URBANIZACION');
        INSERT INTO manzanas (ubicacion_id, estado) VALUES (1, 'activo');
        INSERT INTO villas (manzana_id, estado) VALUES (1, 'activo'), (1, 'inactivo');
      `);
      await applyMigrationInTransaction(pool, 25);
      await pool.query(
        `INSERT INTO residentes (villa_id, nombre, contacto, created_by)
         VALUES (1, 'Ana', '099', 1)`
      );
      await expect(
        pool.query(
          `INSERT INTO residentes (villa_id, nombre, contacto)
           VALUES (1, 'Luis', '098')`
        )
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        pool.query(
          `INSERT INTO residentes (villa_id, nombre, contacto)
           VALUES (2, 'Luis', '098')`
        )
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        pool.query('UPDATE villas SET estado = $1 WHERE id = 1', ['inactivo'])
      ).rejects.toMatchObject({
        code: '23503',
      });
      await expect(pool.query('DELETE FROM villas WHERE id = 1')).rejects.toMatchObject({
        code: '23503',
      });
      await pool.query('UPDATE residentes SET activo = FALSE WHERE villa_id = 1');
      await pool.query('UPDATE villas SET estado = $1 WHERE id = 1', ['inactivo']);
    });
  });
});
