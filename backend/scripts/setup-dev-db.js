// Deja lista una base LOCAL de desarrollo: la crea si falta, aplica el esquema si está vacía,
// corre las migraciones pendientes y carga datos de prueba (idempotente).
// Uso: npm run db:setup-dev   (usa DB_NAME de backend/.env.development)
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('../src/config/config');
const db = require('../src/config/database');
const { runMigrations } = require('../src/config/migrations');

const SCHEMA_PATH = path.resolve(__dirname, '../../database/schema.sql');
const SEED_PASSWORD = process.env.DEV_SEED_PASSWORD || 'Visitas2026x';
const SEED_USERS = [
  { usuario: 'visitas_gerente', tipo: 'gerente', primerLogin: false, cedula: '0900000001' },
  { usuario: 'visitas_guardia', tipo: 'guardia', primerLogin: true, cedula: '0900000002' },
];
const SEED_LOCATION = 'Urbanización de prueba';

const assertLocalDevelopment = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setup-dev-db no puede correr con NODE_ENV=production');
  }
  if (!['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) {
    throw new Error('setup-dev-db solo corre contra una base local');
  }
};

const ensureDatabase = async () => {
  const admin = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      process.env.DB_NAME,
    ]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${process.env.DB_NAME.replaceAll('"', '""')}"`);
      console.log(`Base ${process.env.DB_NAME} creada`);
    }
  } finally {
    await admin.end();
  }
};

const ensureSchema = async () => {
  const result = await db.query("SELECT to_regclass('public.schema_version') AS tabla");
  if (result.rows[0].tabla) return;
  await db.query(await fs.readFile(SCHEMA_PATH, 'utf8'));
  console.log('Esquema base aplicado');
};

const seed = async () => {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  await db.transaction(async (client) => {
    let location = await client.query('SELECT id FROM ubicaciones WHERE nombre = $1', [
      SEED_LOCATION,
    ]);
    if (location.rowCount === 0) {
      location = await client.query(
        `INSERT INTO ubicaciones (nombre, tipo_punto) VALUES ($1, 'URBANIZACION') RETURNING id`,
        [SEED_LOCATION]
      );
    }
    const locationId = location.rows[0].id;

    for (const user of SEED_USERS) {
      const colaborador = await client.query(
        `INSERT INTO colaboradores (nombres_completos, cedula, fecha_nacimiento, cargo)
         VALUES ($1, $2, '1990-01-01', $3)
         ON CONFLICT (cedula) DO UPDATE SET cargo = EXCLUDED.cargo
         RETURNING id`,
        [`Prueba ${user.usuario}`, user.cedula, user.tipo]
      );
      const saved = await client.query(
        `INSERT INTO usuarios
           (usuario, password_hash, nombre, apellido, tipo_usuario, colaborador_id, primer_login,
            activo, intentos_fallidos, bloqueado_hasta)
         VALUES ($1, $2, 'Prueba', $1, $3, $4, $5, TRUE, 0, NULL)
         ON CONFLICT (usuario) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           tipo_usuario = EXCLUDED.tipo_usuario,
           colaborador_id = EXCLUDED.colaborador_id,
           primer_login = EXCLUDED.primer_login,
           activo = TRUE, intentos_fallidos = 0, bloqueado_hasta = NULL
         RETURNING id`,
        [user.usuario, hash, user.tipo, colaborador.rows[0].id, user.primerLogin]
      );
      await client.query(
        `INSERT INTO usuario_ubicaciones (usuario_id, ubicacion_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [saved.rows[0].id, locationId]
      );
    }

    const active = await client.query(
      `SELECT 1 FROM bitacora_visit_form_versions WHERE ubicacion_id = $1 AND estado = 'ACTIVE'`,
      [locationId]
    );
    if (active.rowCount === 0) {
      const version = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM bitacora_visit_form_versions
         WHERE ubicacion_id = $1`,
        [locationId]
      );
      const form = await client.query(
        `INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo)
         VALUES ($1, $2, 'Formulario de visitas') RETURNING id`,
        [locationId, version.rows[0].next]
      );
      await client.query(
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order, requiere_salida)
         VALUES ($1, 'Visita', 1, TRUE), ($1, 'Entrega', 2, FALSE)`,
        [form.rows[0].id]
      );
      // Se publica al final: el esquema impide agregar tipos a un formulario ya publicado.
      await client.query(
        'UPDATE bitacora_visit_form_versions SET published_at = CURRENT_TIMESTAMP WHERE id = $1',
        [form.rows[0].id]
      );
    }
  });
};

const run = async () => {
  assertLocalDevelopment();
  await ensureDatabase();
  await ensureSchema();
  await runMigrations();
  await seed();
  console.log(
    `Base ${process.env.DB_NAME} lista. Usuarios de prueba: ${SEED_USERS.map((u) => u.usuario).join(', ')}`
  );
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
