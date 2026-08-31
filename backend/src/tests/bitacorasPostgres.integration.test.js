const db = require('../config/database');
const repository = require('../repositories/bitacorasRepository');
const {
  lockResidentChainForUpdate,
  lockVillaChainForUpdate,
} = require('../controllers/urbanizacionMastersController');
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
      CREATE TABLE ${schemaIdent}.manzanas (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER NOT NULL REFERENCES ${schemaIdent}.ubicaciones(id) ON DELETE RESTRICT,
        nombre TEXT NOT NULL,
        estado VARCHAR(10) NOT NULL DEFAULT 'activo',
        UNIQUE (id, ubicacion_id)
      );
      CREATE TABLE ${schemaIdent}.villas (
        id SERIAL PRIMARY KEY,
        manzana_id INTEGER NOT NULL REFERENCES ${schemaIdent}.manzanas(id) ON DELETE RESTRICT,
        identificador TEXT NOT NULL,
        estado VARCHAR(10) NOT NULL DEFAULT 'activo',
        UNIQUE (id, manzana_id)
      );
      CREATE TABLE ${schemaIdent}.residentes (
        id SERIAL PRIMARY KEY,
        villa_id INTEGER NOT NULL REFERENCES ${schemaIdent}.villas(id) ON DELETE RESTRICT,
        nombre TEXT NOT NULL,
        contacto TEXT,
        es_principal BOOLEAN NOT NULL DEFAULT FALSE,
        activo BOOLEAN NOT NULL DEFAULT TRUE
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
        manzana_id INTEGER,
        villa_id INTEGER,
        autor_usuario_id INTEGER NOT NULL REFERENCES ${schemaIdent}.usuarios(id) ON DELETE RESTRICT,
        autor_colaborador_id INTEGER NOT NULL REFERENCES ${schemaIdent}.colaboradores(id) ON DELETE RESTRICT,
        ocurrido_at TIMESTAMP NOT NULL,
        detalle TEXT NOT NULL CHECK (detalle ~ '[^[:space:]]'),
        estado VARCHAR(12) NOT NULL DEFAULT 'REGISTRADA',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        anulado_at TIMESTAMP,
        anulado_por_usuario_id INTEGER REFERENCES ${schemaIdent}.usuarios(id) ON DELETE RESTRICT,
        motivo_anulacion TEXT,
        CHECK (villa_id IS NULL OR manzana_id IS NOT NULL),
        FOREIGN KEY (manzana_id, ubicacion_id)
          REFERENCES ${schemaIdent}.manzanas(id, ubicacion_id) ON DELETE RESTRICT,
        FOREIGN KEY (villa_id, manzana_id)
          REFERENCES ${schemaIdent}.villas(id, manzana_id) ON DELETE RESTRICT
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
    await client.query(`
      INSERT INTO manzanas (ubicacion_id, nombre, estado)
      VALUES (2, 'A', 'activo'), (2, 'B', 'activo'), (2, 'Inactiva', 'inactivo');
      INSERT INTO villas (manzana_id, identificador, estado)
      VALUES (1, 'A-1', 'activo'), (2, 'B-1', 'activo'), (1, 'A-X', 'inactivo');
      INSERT INTO residentes (villa_id, nombre, contacto, es_principal, activo)
      VALUES (1, 'Residente A', '0990000000', TRUE, TRUE)
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

      const byCollaborator = await repository.findHistory({
        filters: {
          autor: 'uArDiA u',
          ubicacionId: 1,
          fechaDesde: '2026-08-20',
          estado: 'REGISTRADA',
        },
        hasGlobalScope: false,
        userId: 1,
        pagination: { pageSize: 10, offset: 0 },
        executor: client,
      });
      expect(byCollaborator.total).toBe(3);
      expect(byCollaborator.items).toHaveLength(3);

      const byUsername = await repository.findHistory({
        filters: { autor: 'ARDI' },
        hasGlobalScope: false,
        userId: 1,
        pagination: { pageSize: 10, offset: 0 },
        executor: client,
      });
      expect(byUsername.total).toBe(3);
      expect(byUsername.items.every((item) => item.ubicacion_id === 1)).toBe(true);

      const noAuthorMatch = await repository.findHistory({
        filters: { autor: 'inexistente' },
        hasGlobalScope: false,
        userId: 1,
        pagination: { pageSize: 10, offset: 0 },
        executor: client,
      });
      expect(noAuthorMatch).toEqual({ items: [], total: 0 });
    });
  });

  test('historial devuelve contexto opcional actual sin duplicar COUNT ni paginación', async () => {
    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await client.query('INSERT INTO usuario_ubicaciones VALUES (1, 2) ON CONFLICT DO NOTHING');
      await client.query(`
        INSERT INTO bitacora_registros
          (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
           ocurrido_at, detalle)
        VALUES
          (2, 1, NULL, 1, 1, '2026-08-20 15:00:00', 'Solo Manzana'),
          (2, 1, 1, 1, 1, '2026-08-20 16:00:00', 'Manzana y Villa')
      `);

      const history = await repository.findHistory({
        filters: { ubicacionId: 2 },
        hasGlobalScope: false,
        userId: 1,
        pagination: { pageSize: 25, offset: 0 },
        executor: client,
      });
      expect(history.total).toBe(3);
      expect(history.items).toHaveLength(3);
      expect(history.items.find((item) => item.detalle === 'Solo Manzana')).toEqual(
        expect.objectContaining({
          manzana_id: 1,
          manzana_nombre: 'A',
          villa_id: null,
          villa_identificador: null,
        })
      );
      expect(history.items.find((item) => item.detalle === 'Manzana y Villa')).toEqual(
        expect.objectContaining({ villa_id: 1, villa_identificador: 'A-1' })
      );

      await client.query(String.raw`UPDATE manzanas SET nombre = 'A Renombrada' WHERE id = 1`);
      await client.query(
        String.raw`UPDATE villas SET identificador = 'A-1 Renombrada' WHERE id = 1`
      );
      const renamed = await repository.findHistory({
        filters: { ubicacionId: 2 },
        hasGlobalScope: true,
        userId: 1,
        pagination: { pageSize: 25, offset: 0 },
        executor: client,
      });
      expect(renamed.items.find((item) => item.detalle === 'Manzana y Villa')).toEqual(
        expect.objectContaining({
          manzana_nombre: 'A Renombrada',
          villa_identificador: 'A-1 Renombrada',
        })
      );
      await client.query(
        'DELETE FROM usuario_ubicaciones WHERE usuario_id = 1 AND ubicacion_id = 2'
      );
    });
  });

  test('constraints D1 rechazan cadenas cruzadas y Villa sin Manzana', async () => {
    const insert = (locationId, blockId, villaId) =>
      db.query(
        `INSERT INTO ${schemaIdent}.bitacora_registros
            (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
             ocurrido_at, detalle)
           VALUES ($1, $2, $3, 1, 1, '2026-08-20 17:00:00', 'Adversarial')`,
        [locationId, blockId, villaId]
      );
    await expect(insert(1, 1, null)).rejects.toMatchObject({ code: '23503' });
    await expect(insert(2, 1, 2)).rejects.toMatchObject({ code: '23503' });
    await expect(insert(2, null, 1)).rejects.toMatchObject({ code: '23514' });
  });

  test.each([
    ['Manzana', 'findLockedBlock', 'manzanas', 'blockId'],
    ['Villa', 'findLockedVilla', 'villas', 'villaId'],
  ])(
    'lock de %s serializa su inactivación hasta terminar el POST',
    async (_label, method, table, idKey) => {
      const creator = await db.getClient();
      const editor = await db.getClient();
      try {
        await creator.query('BEGIN');
        await creator.query(`SET LOCAL search_path TO ${schemaIdent}`);
        await repository[method]({ client: creator, [idKey]: 1 });

        await editor.query('BEGIN');
        await editor.query(`SET LOCAL search_path TO ${schemaIdent}`);
        await editor.query(String.raw`SET LOCAL lock_timeout = '100ms'`);
        await expect(
          editor.query(`UPDATE ${table} SET estado = 'inactivo' WHERE id = 1`)
        ).rejects.toMatchObject({
          code: '55P03',
        });
        await editor.query('ROLLBACK');
        await creator.query('COMMIT');

        await editor.query('BEGIN');
        await editor.query(`SET LOCAL search_path TO ${schemaIdent}`);
        const updated = await editor.query(`UPDATE ${table} SET estado = 'inactivo' WHERE id = 1`);
        expect(updated.rowCount).toBe(1);
        await editor.query('ROLLBACK');
      } finally {
        await creator.query('ROLLBACK').catch(() => undefined);
        creator.release();
        await editor.query('ROLLBACK').catch(() => undefined);
        editor.release();
      }
    }
  );

  test('orden Manzana → Villa evita el deadlock con el flujo administrativo', async () => {
    const creator = await db.getClient();
    const administrator = await db.getClient();
    const observer = await db.getClient();
    try {
      await creator.query('BEGIN');
      await creator.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await repository.findLockedBlock({ client: creator, blockId: 1 });

      await administrator.query('BEGIN');
      await administrator.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const pidResult = await administrator.query('SELECT pg_backend_pid() AS pid');
      const administratorPid = pidResult.rows[0].pid;
      const administrativeLock = lockVillaChainForUpdate(administrator, 1);

      let waitingForBlock = false;
      for (let attempt = 0; attempt < 100 && !waitingForBlock; attempt += 1) {
        const state = await observer.query(
          `SELECT wait_event_type
           FROM pg_stat_activity
           WHERE pid = $1`,
          [administratorPid]
        );
        waitingForBlock = state.rows[0]?.wait_event_type === 'Lock';
      }
      expect(waitingForBlock).toBe(true);

      const lockedVilla = await repository.findLockedVilla({ client: creator, villaId: 1 });
      expect(lockedVilla).toEqual(expect.objectContaining({ id: 1, manzana_id: 1 }));
      await creator.query('COMMIT');

      await expect(administrativeLock).resolves.toEqual(
        expect.objectContaining({ id: 1, manzana_id: 1 })
      );
      await administrator.query('ROLLBACK');

      const state = await observer.query(
        `SELECT m.estado AS manzana_estado, v.estado AS villa_estado
         FROM ${schemaIdent}.manzanas m
         JOIN ${schemaIdent}.villas v ON v.manzana_id = m.id
         WHERE m.id = 1 AND v.id = 1`
      );
      expect(state.rows[0]).toEqual({ manzana_estado: 'activo', villa_estado: 'activo' });
    } finally {
      await creator.query('ROLLBACK').catch(() => undefined);
      creator.release();
      await administrator.query('ROLLBACK').catch(() => undefined);
      administrator.release();
      observer.release();
    }
  });

  test('orden Manzana → Villa → Residente evita el deadlock entre crear y actualizar principal', async () => {
    const creator = await db.getClient();
    const updater = await db.getClient();
    const observer = await db.getClient();
    try {
      await creator.query('BEGIN');
      await creator.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await repository.findLockedBlock({ client: creator, blockId: 1 });
      await repository.findLockedVilla({ client: creator, villaId: 1 });

      await updater.query('BEGIN');
      await updater.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const pidResult = await updater.query('SELECT pg_backend_pid() AS pid');
      const updaterPid = pidResult.rows[0].pid;
      const updateLock = lockResidentChainForUpdate(updater, 1);

      let waitingForBlock = false;
      for (let attempt = 0; attempt < 100 && !waitingForBlock; attempt += 1) {
        const state = await observer.query(
          `SELECT wait_event_type
           FROM pg_stat_activity
           WHERE pid = $1`,
          [updaterPid]
        );
        waitingForBlock = state.rows[0]?.wait_event_type === 'Lock';
      }
      expect(waitingForBlock).toBe(true);

      await creator.query(String.raw`SET LOCAL lock_timeout = '100ms'`);
      const resident = await creator.query('SELECT id FROM residentes WHERE id = 1 FOR UPDATE');
      expect(resident.rows[0]).toEqual({ id: 1 });
      await creator.query('COMMIT');

      await expect(updateLock).resolves.toEqual({
        current: expect.objectContaining({ id: 1, villa_id: 1, activo: true }),
        villa: expect.objectContaining({ id: 1, manzana_id: 1 }),
      });
      await updater.query('COMMIT');

      const state = await observer.query(
        `SELECT m.estado AS manzana_estado, v.estado AS villa_estado,
                r.activo AS residente_activo
         FROM ${schemaIdent}.manzanas m
         JOIN ${schemaIdent}.villas v ON v.manzana_id = m.id
         JOIN ${schemaIdent}.residentes r ON r.villa_id = v.id
         WHERE m.id = 1 AND v.id = 1 AND r.id = 1`
      );
      expect(state.rows[0]).toEqual({
        manzana_estado: 'activo',
        villa_estado: 'activo',
        residente_activo: true,
      });
    } finally {
      await creator.query('ROLLBACK').catch(() => undefined);
      creator.release();
      await updater.query('ROLLBACK').catch(() => undefined);
      updater.release();
      observer.release();
    }
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

  test('resolución de opciones colapsa recursos inexistentes y fuera de scope', async () => {
    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const missingBlock = await repository.findVisibleBlock({
        blockId: 999,
        hasGlobalScope: false,
        userId: 1,
        executor: client,
      });
      const hiddenBlock = await repository.findVisibleBlock({
        blockId: 1,
        hasGlobalScope: false,
        userId: 1,
        executor: client,
      });
      const globalBlock = await repository.findVisibleBlock({
        blockId: 1,
        hasGlobalScope: true,
        userId: 1,
        executor: client,
      });
      expect(missingBlock).toBeNull();
      expect(hiddenBlock).toBeNull();
      expect(globalBlock).toEqual(expect.objectContaining({ id: 1, ubicacion_id: 2 }));

      const missingLocation = await repository.findVisibleLocation({
        locationId: 999,
        hasGlobalScope: false,
        userId: 1,
        executor: client,
      });
      const hiddenLocation = await repository.findVisibleLocation({
        locationId: 2,
        hasGlobalScope: false,
        userId: 1,
        executor: client,
      });
      expect(missingLocation).toBeNull();
      expect(hiddenLocation).toBeNull();
    });
  });

  test('opciones de Villas para Bitácoras solo incluyen Casas activas con titular activo', async () => {
    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      const options = await repository.findActiveVillasForBlock({
        blockId: 1,
        executor: client,
      });

      expect(options).toEqual([
        expect.objectContaining({
          id: 1,
          identificador: 'A-1 Renombrada',
          residente_principal_nombre: 'Residente A',
          residente_principal_contacto: '0990000000',
        }),
      ]);
      expect(options.map((option) => option.identificador)).not.toContain('A-X');

      const optionsWithoutResident = await repository.findActiveVillasForBlock({
        blockId: 2,
        executor: client,
      });

      expect(optionsWithoutResident).toEqual([]);
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

  test('RESTRICT preserva Ubicación y Bitácora histórica', async () => {
    await expect(
      db.query(`DELETE FROM ${schemaIdent}.ubicaciones WHERE id = 1`)
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'bitacora_registros_ubicacion_id_fkey',
    });

    const preserved = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ${schemaIdent}.ubicaciones WHERE id = 1) AS ubicaciones,
         (SELECT COUNT(*)::int FROM ${schemaIdent}.bitacora_registros
          WHERE ubicacion_id = 1) AS registros`
    );
    expect(preserved.rows[0].ubicaciones).toBe(1);
    expect(preserved.rows[0].registros).toBeGreaterThan(0);
  });

  test('RESTRICT preserva Usuario autor y Bitácora histórica', async () => {
    await expect(
      db.query(`DELETE FROM ${schemaIdent}.usuarios WHERE id = 1`)
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'bitacora_registros_autor_usuario_id_fkey',
    });

    const preserved = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ${schemaIdent}.usuarios WHERE id = 1) AS usuarios,
         (SELECT COUNT(*)::int FROM ${schemaIdent}.bitacora_registros
          WHERE autor_usuario_id = 1) AS registros`
    );
    expect(preserved.rows[0].usuarios).toBe(1);
    expect(preserved.rows[0].registros).toBeGreaterThan(0);
  });

  test('RESTRICT preserva Usuario anulador y Bitácora histórica', async () => {
    await db.query(
      `INSERT INTO ${schemaIdent}.usuarios (usuario, colaborador_id)
       VALUES ('anulador', NULL)`
    );
    await db.query(
      `UPDATE ${schemaIdent}.bitacora_registros
       SET estado = 'ANULADA',
           anulado_at = '2026-08-20 14:00:00',
           anulado_por_usuario_id = 2,
           motivo_anulacion = 'Corrección'
       WHERE id = 1`
    );

    await expect(
      db.query(`DELETE FROM ${schemaIdent}.usuarios WHERE id = 2`)
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'bitacora_registros_anulado_por_usuario_id_fkey',
    });

    const preserved = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ${schemaIdent}.usuarios WHERE id = 2) AS usuarios,
         (SELECT COUNT(*)::int FROM ${schemaIdent}.bitacora_registros
          WHERE anulado_por_usuario_id = 2) AS registros`
    );
    expect(preserved.rows[0]).toEqual({ usuarios: 1, registros: 1 });
  });
});
