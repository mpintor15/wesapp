const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const E2E_DB_NAME = process.env.E2E_DB_NAME || process.env.DB_NAME || 'wesapp_e2e';
const ADMIN_DB_NAME = process.env.E2E_ADMIN_DB_NAME || 'postgres';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'E2E_Local_Password_123!';
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const assertSafeDatabaseName = (dbName) => {
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('E2E database name must contain only letters, numbers and underscores');
  }

  if (!dbName.endsWith('_e2e')) {
    throw new Error('E2E database name must end with _e2e');
  }

  if (['wesapp', 'wesapp_test', 'postgres', 'template0', 'template1'].includes(dbName)) {
    throw new Error(`Refusing to reset unsafe database: ${dbName}`);
  }
};

const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;

const createPool = (database) =>
  new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  });

const resetDatabase = async () => {
  const adminPool = createPool(ADMIN_DB_NAME);
  const dbIdentifier = quoteIdentifier(E2E_DB_NAME);

  try {
    await adminPool.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `,
      [E2E_DB_NAME]
    );
    await adminPool.query(`DROP DATABASE IF EXISTS ${dbIdentifier}`);
    await adminPool.query(`CREATE DATABASE ${dbIdentifier}`);
  } finally {
    await adminPool.end();
  }
};

const buildSchema = async (pool) => {
  const schemaSql = await fs.readFile(path.join(ROOT_DIR, 'database/schema.sql'), 'utf8');
  await pool.query(schemaSql);
};

// database/schema.sql is a maintained snapshot that currently reflects migrations up to #28.
// Migrations #29-32 (Visitas + Formularios de visita + motivo_anulacion + tipos de visita
// configurables) are still pending on this branch and haven't been folded into the snapshot
// yet, so apply them explicitly here.
const PENDING_MIGRATIONS = [
  '029_bitacora_visitas.sql',
  '030_bitacora_visit_form_applicability.sql',
  '031_bitacora_visita_anulacion.sql',
  '032_bitacora_visit_form_tipos.sql',
];

const applyPendingMigrations = async (pool) => {
  for (const fileName of PENDING_MIGRATIONS) {
    const sql = await fs.readFile(path.join(ROOT_DIR, 'database/migrations', fileName), 'utf8');
    await pool.query(sql);
  }
};

const clearDevelopmentSeed = async (pool) => {
  await pool.query(`
    TRUNCATE
      inventario_stock_efectos,
      detalle_movimientos,
      movimientos,
      articulos_bajas,
      articulos,
      ubicaciones,
      abonos,
      pagos,
      cuentas,
      clientes,
      colaboradores,
      audit_log,
      usuarios
    RESTART IDENTITY CASCADE
  `);
};

const seedE2eFixtures = async (pool) => {
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  const colaboradores = await pool.query(`
    INSERT INTO colaboradores (nombres_completos, cedula, fecha_nacimiento, cargo, estado)
    VALUES
      ('Gerente E2E', 'E2E-COL-001', '1990-01-01', 'Gerente', 'activo'),
      ('Contador E2E', 'E2E-COL-002', '1990-01-01', 'Contador', 'activo'),
      ('Guardia E2E', 'E2E-COL-003', '1990-01-01', 'Guardia', 'activo'),
      ('Supervisor E2E', 'E2E-COL-004', '1990-01-01', 'Supervisor', 'activo')
    RETURNING id
  `);

  const gerente = await pool.query(
    `
      INSERT INTO usuarios
        (usuario, password_hash, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo)
      VALUES ($1, $2, 'Gerente', 'E2E', 'gerente', $3, FALSE, TRUE)
      RETURNING id
    `,
    ['e2e_gerente', passwordHash, colaboradores.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO usuarios
        (usuario, password_hash, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo)
      VALUES ($1, $2, 'Contador', 'E2E', 'contador', $3, FALSE, TRUE)
    `,
    ['e2e_contador', passwordHash, colaboradores.rows[1].id]
  );

  const guardia = await pool.query(
    `
      INSERT INTO usuarios
        (usuario, password_hash, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo)
      VALUES ($1, $2, 'Guardia', 'E2E', 'guardia', $3, FALSE, TRUE)
      RETURNING id
    `,
    ['e2e_guardia', passwordHash, colaboradores.rows[2].id]
  );

  const supervisor = await pool.query(
    `
      INSERT INTO usuarios
        (usuario, password_hash, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo)
      VALUES ($1, $2, 'Supervisor', 'E2E', 'supervisor', $3, FALSE, TRUE)
      RETURNING id
    `,
    ['e2e_supervisor', passwordHash, colaboradores.rows[3].id]
  );

  // Urbanización fixture for the Bitácoras/Visitas/Formularios E2E smoke suite. Kept on its own
  // client-less location (cliente_id NULL) so it never overlaps with the Cuentas/Inventario
  // fixtures above.
  const ubicacionUrbanizacion = await pool.query(
    `
      INSERT INTO ubicaciones (nombre, cliente_id, tipo_punto)
      VALUES ($1, NULL, 'URBANIZACION')
      RETURNING id
    `,
    ['Urbanización E2E Bitácoras']
  );

  await pool.query(
    `
      INSERT INTO usuario_ubicaciones (usuario_id, ubicacion_id)
      VALUES ($1, $3), ($2, $3)
    `,
    [guardia.rows[0].id, supervisor.rows[0].id, ubicacionUrbanizacion.rows[0].id]
  );

  const manzanaUrbanizacion = await pool.query(
    `
      INSERT INTO manzanas (ubicacion_id, nombre, estado)
      VALUES ($1, 'Manzana E2E', 'activo')
      RETURNING id
    `,
    [ubicacionUrbanizacion.rows[0].id]
  );

  const villaUrbanizacion = await pool.query(
    `
      INSERT INTO villas (manzana_id, identificador, estado)
      VALUES ($1, 'V1 E2E', 'activo')
      RETURNING id
    `,
    [manzanaUrbanizacion.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO residentes (villa_id, nombre, contacto, es_principal, activo)
      VALUES ($1, 'Residente E2E Principal', '0991234567', TRUE, TRUE)
    `,
    [villaUrbanizacion.rows[0].id]
  );

  const cliente = await pool.query(
    `
      INSERT INTO clientes (nombre, identificacion, tipo_identificacion, telefono, correo, direccion, ciudad, estado)
      VALUES ($1, $2, 'ruc', '0999999999', 'e2e@example.local', 'Dirección E2E', 'Quito', 'activo')
      RETURNING id
    `,
    ['Cliente E2E Alfa', 'E2E-CLIENTE-001']
  );

  const ubicacion = await pool.query(
    `
      INSERT INTO ubicaciones (nombre, cliente_id)
      VALUES ($1, $2)
      RETURNING id
    `,
    ['Bodega E2E Norte', cliente.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO clientes (nombre, identificacion, tipo_identificacion, telefono, correo, direccion, ciudad, estado)
      VALUES ($1, $2, 'ruc', '0988888888', 'sin-ubicaciones@example.local', 'Dirección E2E', 'Quito', 'activo')
      RETURNING id
    `,
    ['Cliente E2E Sin Ubicaciones', 'E2E-CLIENTE-002']
  );

  const clienteMultiple = await pool.query(
    `
      INSERT INTO clientes (nombre, identificacion, tipo_identificacion, telefono, correo, direccion, ciudad, estado)
      VALUES ($1, $2, 'ruc', '0977777777', 'multiple@example.local', 'Dirección E2E', 'Quito', 'activo')
      RETURNING id
    `,
    ['Cliente E2E Multiple', 'E2E-CLIENTE-003']
  );

  await pool.query(
    `
      INSERT INTO ubicaciones (nombre, cliente_id)
      VALUES ($1, $2), ($3, $2)
    `,
    ['Bodega E2E Sur', clienteMultiple.rows[0].id, 'Archivo E2E Libre']
  );

  await pool.query(
    `
      INSERT INTO ubicaciones (nombre, cliente_id)
      VALUES ($1, NULL)
    `,
    ['Histórica E2E Sin Cliente']
  );

  const articulo = await pool.query(
    `
      INSERT INTO articulos (
        tipo_articulo,
        nombre_articulo,
        cantidad,
        marca,
        modelo,
        numero_serie,
        codigo_radio,
        ubicacion_id
      )
      VALUES ('radio', $1, 1, 'Motorola', 'E2E-Model', 'E2E-RADIO-001', 'E2E-COD-RADIO-001', $2)
      RETURNING id
    `,
    ['Radio E2E Alpha', ubicacion.rows[0].id]
  );

  const movimiento = await pool.query(
    `
      INSERT INTO movimientos (usuario_id, fecha_movimiento, estado, reversion_datos_completos)
      VALUES ($1, '2026-01-15 10:00:00', 'ACTIVO', TRUE)
      RETURNING id
    `,
    [gerente.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO detalle_movimientos (
        movimiento_id,
        articulo_id,
        cantidad,
        ubicacion_origen_id,
        ubicacion_destino_id
      )
      VALUES ($1, $2, 1, NULL, $3)
    `,
    [movimiento.rows[0].id, articulo.rows[0].id, ubicacion.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO cuentas (
        num_factura,
        cliente_id,
        fecha_factura,
        valor_factura,
        incluye_iva,
        incluye_retencion_fuente,
        incluye_retencion_iva,
        cancelada
      )
      VALUES (900001, $1, '2026-01-10', 100.00, TRUE, FALSE, FALSE, FALSE)
    `,
    [cliente.rows[0].id]
  );

  const pago = await pool.query(
    `
      INSERT INTO pagos (cliente_id, fecha, metodo_pago, referencia, notas, total)
      VALUES ($1, '2026-01-20', 'transferencia', 'E2E-REF-001', 'Pago fixture E2E', 25.00)
      RETURNING id
    `,
    [cliente.rows[0].id]
  );

  await pool.query(
    `
      INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono)
      VALUES ($1, 900001, '2026-01-20', 25.00)
    `,
    [pago.rows[0].id]
  );
};

const main = async () => {
  assertSafeDatabaseName(E2E_DB_NAME);
  await resetDatabase();

  const e2ePool = createPool(E2E_DB_NAME);
  try {
    await buildSchema(e2ePool);
    await applyPendingMigrations(e2ePool);
    await clearDevelopmentSeed(e2ePool);
    await seedE2eFixtures(e2ePool);
  } finally {
    await e2ePool.end();
  }

  console.log(`E2E database prepared: ${E2E_DB_NAME}`);
  console.log('E2E fixture users: e2e_gerente, e2e_contador, e2e_guardia, e2e_supervisor');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
