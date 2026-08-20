const db = require('../config/database');
const repository = require('../repositories/bitacorasRepository');
const {
  assertSafeTestDatabase,
  buildSafeTestResourceName,
} = require('./helpers/testDatabaseSafety');

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;

describe('bitacoras PostgreSQL API persistence', () => {
  let schemaName;
  let schemaIdent;

  beforeAll(async () => {
    assertSafeTestDatabase(process.env.DB_NAME);
    schemaName = buildSafeTestResourceName('bitacoras_api_schema');
    schemaIdent = quoteIdent(schemaName);
    await db.query(`CREATE SCHEMA ${schemaIdent}`);
    await db.query(`
      CREATE TABLE ${schemaIdent}.clientes (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL
      );
      CREATE TABLE ${schemaIdent}.ubicaciones (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        cliente_id INTEGER REFERENCES ${schemaIdent}.clientes(id),
        tipo_punto VARCHAR(20) NOT NULL DEFAULT 'GENERAL'
      );
      CREATE TABLE ${schemaIdent}.usuarios (
        id SERIAL PRIMARY KEY,
        usuario TEXT NOT NULL,
        colaborador_id INTEGER,
        activo BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE ${schemaIdent}.colaboradores (
        id SERIAL PRIMARY KEY,
        nombres_completos TEXT NOT NULL
      );
      CREATE TABLE ${schemaIdent}.usuario_ubicaciones (
        usuario_id INTEGER NOT NULL,
        ubicacion_id INTEGER NOT NULL,
        PRIMARY KEY (usuario_id, ubicacion_id)
      );
      CREATE TABLE ${schemaIdent}.bitacora_registros (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER NOT NULL REFERENCES ${schemaIdent}.ubicaciones(id) ON DELETE RESTRICT,
        autor_usuario_id INTEGER NOT NULL REFERENCES ${schemaIdent}.usuarios(id) ON DELETE RESTRICT,
        autor_colaborador_id INTEGER NOT NULL REFERENCES ${schemaIdent}.colaboradores(id) ON DELETE RESTRICT,
        ocurrido_at TIMESTAMP NOT NULL,
        detalle TEXT NOT NULL CHECK (detalle ~ '[^[:space:]]'),
        estado VARCHAR(12) NOT NULL DEFAULT 'REGISTRADA',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        anulado_at TIMESTAMP,
        anulado_por_usuario_id INTEGER,
        motivo_anulacion TEXT
      );
      CREATE TABLE ${schemaIdent}.audit_log (
        id SERIAL PRIMARY KEY,
        tabla TEXT NOT NULL,
        operacion TEXT NOT NULL,
        registro_id TEXT,
        datos_nuevos JSONB
      );
    `);
  });

  afterAll(async () => {
    if (schemaIdent) {
      await db.query(`DROP SCHEMA IF EXISTS ${schemaIdent} CASCADE`);
    }
    await db.close();
  });

  const seed = async (client) => {
    await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
    await client.query(String.raw`INSERT INTO clientes (nombre) VALUES ('Cliente')`);
    await client.query(`
      INSERT INTO ubicaciones (nombre, cliente_id, tipo_punto)
      VALUES ('Asignada', 1, 'GENERAL'), ('No asignada', 1, 'URBANIZACION')
    `);
    await client.query(
      String.raw`INSERT INTO colaboradores (nombres_completos) VALUES ('Guardia Uno')`
    );
    await client.query(
      String.raw`INSERT INTO usuarios (usuario, colaborador_id) VALUES ('guardia', 1)`
    );
    await client.query('INSERT INTO usuario_ubicaciones VALUES (1, 1)');
    await client.query(`
      INSERT INTO bitacora_registros
        (ubicacion_id, autor_usuario_id, autor_colaborador_id, ocurrido_at, detalle)
      VALUES
        (1, 1, 1, '2026-08-20 10:00:00', 'Primera'),
        (1, 1, 1, '2026-08-20 10:00:00', 'Segunda'),
        (2, 1, 1, '2026-08-20 09:00:00', 'Fuera de alcance')
    `);
  };

  test('inserta con auditoría y revierte ambas escrituras si la auditoría falla', async () => {
    await db.transaction(async (client) => {
      await seed(client);
      const inserted = await client.query(
        `INSERT INTO bitacora_registros
          (ubicacion_id, autor_usuario_id, autor_colaborador_id, ocurrido_at, detalle)
         VALUES (1, 1, 1, '2026-08-20 11:00:00', 'Creación atómica') RETURNING id`
      );
      await client.query(
        `INSERT INTO audit_log (tabla, operacion, registro_id, datos_nuevos)
         VALUES ('bitacora_registros', 'INSERT', $1, $2)`,
        [String(inserted.rows[0].id), JSON.stringify({ detalle: 'Creación atómica' })]
      );
      const counts = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM bitacora_registros) AS registros,
           (SELECT COUNT(*)::int FROM audit_log) AS auditorias`
      );
      expect(counts.rows[0]).toEqual({ registros: 4, auditorias: 1 });
    });

    await expect(
      db.transaction(async (client) => {
        await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
        await client.query(
          `INSERT INTO bitacora_registros
            (ubicacion_id, autor_usuario_id, autor_colaborador_id, ocurrido_at, detalle)
           VALUES (1, 1, 1, '2026-08-20 12:00:00', 'Debe revertirse')`
        );
        await client.query('INSERT INTO audit_log (tabla) VALUES (NULL)');
      })
    ).rejects.toMatchObject({ code: '23502' });

    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const result = await client.query(
        String.raw`SELECT COUNT(*)::int AS count FROM bitacora_registros WHERE detalle = 'Debe revertirse'`
      );
      expect(result.rows[0].count).toBe(0);
    });
  });

  test('consulta asignada sin fuga, con filtros y orden estable', async () => {
    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const assigned = await repository.findHistory({
        filters: { fechaDesde: '2026-08-20', estado: 'REGISTRADA' },
        hasGlobalScope: false,
        userId: 1,
        pagination: { pageSize: 10, offset: 0 },
        executor: client,
      });
      expect(assigned.total).toBe(3);
      expect(assigned.items.map((item) => item.detalle)).toEqual([
        'Creación atómica',
        'Segunda',
        'Primera',
      ]);
      expect(assigned.items.every((item) => item.ubicacion_id === 1)).toBe(true);

      const global = await repository.findHistory({
        filters: {},
        hasGlobalScope: true,
        userId: 1,
        pagination: { pageSize: 2, offset: 0 },
        executor: client,
      });
      expect(global.total).toBe(4);
      expect(global.items).toHaveLength(2);
    });
  });

  test('lista solo Ubicaciones asignadas o todas según alcance', async () => {
    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const assigned = await repository.findVisibleLocations({
        hasGlobalScope: false,
        userId: 1,
        executor: client,
      });
      const global = await repository.findVisibleLocations({
        hasGlobalScope: true,
        userId: 1,
        executor: client,
      });
      expect(assigned.map((location) => location.nombre)).toEqual(['Asignada']);
      expect(global).toHaveLength(2);
    });
  });

  test('FOR KEY SHARE impide retirar la asignación durante la creación', async () => {
    const creator = await db.getClient();
    const assignmentEditor = await db.getClient();
    try {
      await creator.query('BEGIN');
      await creator.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const locked = await repository.findLockedUserLocationAssignment({
        client: creator,
        userId: 1,
        locationId: 1,
      });
      expect(locked).toEqual({ usuario_id: 1, ubicacion_id: 1 });

      const inserted = await creator.query(
        `INSERT INTO bitacora_registros
          (ubicacion_id, autor_usuario_id, autor_colaborador_id, ocurrido_at, detalle)
         VALUES (1, 1, 1, '2026-08-20 13:00:00', 'Alcance bloqueado')
         RETURNING id`
      );
      await creator.query(
        `INSERT INTO audit_log (tabla, operacion, registro_id, datos_nuevos)
         VALUES ('bitacora_registros', 'INSERT', $1, $2)`,
        [String(inserted.rows[0].id), JSON.stringify({ detalle: 'Alcance bloqueado' })]
      );

      await assignmentEditor.query('BEGIN');
      await assignmentEditor.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await assignmentEditor.query(String.raw`SET LOCAL lock_timeout = '100ms'`);
      await expect(
        assignmentEditor.query(
          'DELETE FROM usuario_ubicaciones WHERE usuario_id = 1 AND ubicacion_id = 1'
        )
      ).rejects.toMatchObject({ code: '55P03' });
      await assignmentEditor.query('ROLLBACK');

      await creator.query('COMMIT');

      await assignmentEditor.query('BEGIN');
      await assignmentEditor.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const deleted = await assignmentEditor.query(
        'DELETE FROM usuario_ubicaciones WHERE usuario_id = 1 AND ubicacion_id = 1'
      );
      expect(deleted.rowCount).toBe(1);
      await assignmentEditor.query('ROLLBACK');

      const committed = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM ${schemaIdent}.bitacora_registros
         WHERE detalle = 'Alcance bloqueado'`
      );
      expect(committed.rows[0].count).toBe(1);
    } finally {
      if (!creator.released) {
        await creator.query('ROLLBACK').catch(() => undefined);
        creator.release();
      }
      if (!assignmentEditor.released) {
        await assignmentEditor.query('ROLLBACK').catch(() => undefined);
        assignmentEditor.release();
      }
    }
  });

  test('RESTRICT preserva Colaborador y Bitácora histórica', async () => {
    await db.query(
      `UPDATE ${schemaIdent}.usuarios
       SET colaborador_id = NULL
       WHERE id = 1`
    );

    await expect(
      db.query(`DELETE FROM ${schemaIdent}.colaboradores WHERE id = 1`)
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'bitacora_registros_autor_colaborador_id_fkey',
    });

    const preserved = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ${schemaIdent}.colaboradores WHERE id = 1) AS colaboradores,
         (SELECT COUNT(*)::int FROM ${schemaIdent}.bitacora_registros
          WHERE autor_colaborador_id = 1) AS registros`
    );
    expect(preserved.rows[0].colaboradores).toBe(1);
    expect(preserved.rows[0].registros).toBeGreaterThan(0);
  });
});
