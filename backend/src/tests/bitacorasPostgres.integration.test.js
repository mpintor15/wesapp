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
        origen VARCHAR(12) NOT NULL DEFAULT 'MANUAL' CHECK (origen IN ('MANUAL', 'VISITA')),
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
      CREATE TABLE ${schemaIdent}.bitacora_visit_form_versions (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER NOT NULL REFERENCES ${schemaIdent}.ubicaciones(id) ON DELETE RESTRICT,
        version INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        mostrar_fecha_hora BOOLEAN NOT NULL DEFAULT TRUE,
        mostrar_casa BOOLEAN NOT NULL DEFAULT TRUE,
        estado VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (estado IN ('ACTIVE', 'ARCHIVED')),
        created_by INTEGER REFERENCES ${schemaIdent}.usuarios(id) ON DELETE SET NULL,
        published_by INTEGER REFERENCES ${schemaIdent}.usuarios(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        UNIQUE (ubicacion_id, version),
        UNIQUE (id, ubicacion_id)
      );
      CREATE UNIQUE INDEX idx_test_visit_forms_one_active
        ON ${schemaIdent}.bitacora_visit_form_versions (ubicacion_id)
        WHERE estado = 'ACTIVE';
      CREATE TABLE ${schemaIdent}.bitacora_visit_form_fields (
        id SERIAL PRIMARY KEY,
        form_version_id INTEGER NOT NULL REFERENCES ${schemaIdent}.bitacora_visit_form_versions(id) ON DELETE RESTRICT,
        field_key TEXT NOT NULL,
        label TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa')),
        required BOOLEAN NOT NULL DEFAULT FALSE,
        aplica_a VARCHAR(20) NOT NULL DEFAULT 'TODOS' CHECK (aplica_a IN ('TODOS', 'SELECCIONADOS')),
        options JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (form_version_id, field_key),
        UNIQUE (id, form_version_id)
      );
      CREATE TABLE ${schemaIdent}.bitacora_visit_form_tipos (
        id SERIAL PRIMARY KEY,
        form_version_id INTEGER NOT NULL REFERENCES ${schemaIdent}.bitacora_visit_form_versions(id) ON DELETE RESTRICT,
        nombre VARCHAR(60) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (form_version_id, nombre),
        UNIQUE (id, form_version_id)
      );
      CREATE TABLE ${schemaIdent}.bitacora_visit_form_field_tipos (
        form_field_id INTEGER NOT NULL,
        form_version_id INTEGER NOT NULL,
        tipo_id INTEGER NOT NULL,
        PRIMARY KEY (form_field_id, tipo_id),
        FOREIGN KEY (form_field_id, form_version_id)
          REFERENCES ${schemaIdent}.bitacora_visit_form_fields(id, form_version_id) ON DELETE RESTRICT,
        FOREIGN KEY (tipo_id, form_version_id)
          REFERENCES ${schemaIdent}.bitacora_visit_form_tipos(id, form_version_id) ON DELETE RESTRICT
      );
      ALTER TABLE ${schemaIdent}.residentes
        ADD CONSTRAINT residentes_id_villa_unique UNIQUE (id, villa_id);
      CREATE TABLE ${schemaIdent}.bitacora_visitas (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER NOT NULL REFERENCES ${schemaIdent}.ubicaciones(id) ON DELETE RESTRICT,
        manzana_id INTEGER NOT NULL,
        villa_id INTEGER NOT NULL,
        residente_principal_id INTEGER NOT NULL,
        form_version_id INTEGER NOT NULL,
        visitante_nombre TEXT NOT NULL,
        visitante_documento TEXT NOT NULL,
        visitante_telefono TEXT NOT NULL,
        tipo_visita_id INTEGER NOT NULL,
        placa TEXT,
        estado VARCHAR(12) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA', 'ANULADA')),
        entrada_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        salida_at TIMESTAMP,
        registrado_por_usuario_id INTEGER NOT NULL REFERENCES ${schemaIdent}.usuarios(id) ON DELETE RESTRICT,
        registrado_por_colaborador_id INTEGER NOT NULL REFERENCES ${schemaIdent}.colaboradores(id) ON DELETE RESTRICT,
        cerrado_por_usuario_id INTEGER REFERENCES ${schemaIdent}.usuarios(id) ON DELETE RESTRICT,
        cerrado_por_colaborador_id INTEGER REFERENCES ${schemaIdent}.colaboradores(id) ON DELETE RESTRICT,
        entrada_bitacora_registro_id INTEGER REFERENCES ${schemaIdent}.bitacora_registros(id) ON DELETE RESTRICT,
        salida_bitacora_registro_id INTEGER REFERENCES ${schemaIdent}.bitacora_registros(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manzana_id, ubicacion_id) REFERENCES ${schemaIdent}.manzanas(id, ubicacion_id) ON DELETE RESTRICT,
        FOREIGN KEY (villa_id, manzana_id) REFERENCES ${schemaIdent}.villas(id, manzana_id) ON DELETE RESTRICT,
        FOREIGN KEY (residente_principal_id, villa_id) REFERENCES ${schemaIdent}.residentes(id, villa_id) ON DELETE RESTRICT,
        FOREIGN KEY (form_version_id, ubicacion_id) REFERENCES ${schemaIdent}.bitacora_visit_form_versions(id, ubicacion_id) ON DELETE RESTRICT,
        FOREIGN KEY (tipo_visita_id, form_version_id) REFERENCES ${schemaIdent}.bitacora_visit_form_tipos(id, form_version_id) ON DELETE RESTRICT,
        CHECK (visitante_documento ~ '^[0-9]{10}$')
      );
      CREATE TABLE ${schemaIdent}.bitacora_visita_respuestas (
        id SERIAL PRIMARY KEY,
        visita_id INTEGER NOT NULL REFERENCES ${schemaIdent}.bitacora_visitas(id) ON DELETE RESTRICT,
        form_field_id INTEGER NOT NULL REFERENCES ${schemaIdent}.bitacora_visit_form_fields(id) ON DELETE RESTRICT,
        field_key_snapshot TEXT NOT NULL,
        label_snapshot TEXT NOT NULL,
        type_snapshot TEXT NOT NULL,
        value_text TEXT,
        value_json JSONB,
        UNIQUE (visita_id, form_field_id)
      );
      CREATE TABLE ${schemaIdent}.audit_log (
        id SERIAL PRIMARY KEY,
        tabla TEXT NOT NULL,
        operacion TEXT NOT NULL,
        registro_id TEXT,
        datos_nuevos JSONB
      );
      CREATE OR REPLACE FUNCTION ${schemaIdent}.enforce_bitacora_visit_form_version_lifecycle()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Los formularios de visita publicados no se pueden eliminar'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ARCHIVED'
           AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
           AND NEW.id = OLD.id
           AND NEW.ubicacion_id = OLD.ubicacion_id
           AND NEW.version = OLD.version
           AND NEW.titulo = OLD.titulo
           AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
           AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
           AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
           AND NEW.created_at = OLD.created_at
           AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
          RETURN NEW;
        END IF;

        IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ACTIVE'
           AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
           AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
           AND NEW.id = OLD.id
           AND NEW.ubicacion_id = OLD.ubicacion_id
           AND NEW.version = OLD.version
           AND NEW.titulo = OLD.titulo
           AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
           AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
           AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
           AND NEW.created_at = OLD.created_at THEN
          RETURN NEW;
        END IF;

        IF OLD.estado = 'ARCHIVED' AND NEW.estado = 'ARCHIVED'
           AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
           AND NEW.id = OLD.id
           AND NEW.ubicacion_id = OLD.ubicacion_id
           AND NEW.version = OLD.version
           AND NEW.titulo = OLD.titulo
           AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
           AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
           AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
           AND NEW.created_at = OLD.created_at
           AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
          USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER enforce_bitacora_visit_form_version_lifecycle_trigger
        BEFORE UPDATE OR DELETE ON ${schemaIdent}.bitacora_visit_form_versions
        FOR EACH ROW EXECUTE FUNCTION ${schemaIdent}.enforce_bitacora_visit_form_version_lifecycle();
      CREATE OR REPLACE FUNCTION ${schemaIdent}.enforce_bitacora_visit_form_field_immutability()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF EXISTS (
            SELECT 1
            FROM ${schemaIdent}.bitacora_visit_form_versions
            WHERE id = NEW.form_version_id AND published_at IS NULL
          ) THEN
            RETURN NEW;
          END IF;

          RAISE EXCEPTION 'No se pueden agregar campos a un formulario de visita publicado'
            USING ERRCODE = '23514';
        END IF;

        RAISE EXCEPTION 'Los campos de formularios de visita publicados son inmutables'
          USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger
        BEFORE INSERT OR UPDATE OR DELETE ON ${schemaIdent}.bitacora_visit_form_fields
        FOR EACH ROW EXECUTE FUNCTION ${schemaIdent}.enforce_bitacora_visit_form_field_immutability();
      CREATE OR REPLACE FUNCTION ${schemaIdent}.enforce_bitacora_visit_form_tipo_immutability()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF EXISTS (
            SELECT 1
            FROM ${schemaIdent}.bitacora_visit_form_versions
            WHERE id = NEW.form_version_id AND published_at IS NULL
          ) THEN
            RETURN NEW;
          END IF;

          RAISE EXCEPTION 'No se pueden agregar tipos de visita a un formulario publicado'
            USING ERRCODE = '23514';
        END IF;

        RAISE EXCEPTION 'Los tipos de visita de formularios publicados son inmutables'
          USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER enforce_bitacora_visit_form_tipo_immutability_trigger
        BEFORE INSERT OR UPDATE OR DELETE ON ${schemaIdent}.bitacora_visit_form_tipos
        FOR EACH ROW EXECUTE FUNCTION ${schemaIdent}.enforce_bitacora_visit_form_tipo_immutability();
      CREATE OR REPLACE FUNCTION ${schemaIdent}.enforce_bitacora_visita_titular_activo()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM ${schemaIdent}.residentes
          WHERE id = NEW.residente_principal_id
            AND villa_id = NEW.villa_id
            AND es_principal = TRUE
            AND activo = TRUE
        ) THEN
          RAISE EXCEPTION 'La visita debe apuntar al titular activo de la Villa'
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER enforce_bitacora_visita_titular_activo_trigger
        BEFORE INSERT OR UPDATE OF residente_principal_id, villa_id ON ${schemaIdent}.bitacora_visitas
        FOR EACH ROW EXECUTE FUNCTION ${schemaIdent}.enforce_bitacora_visita_titular_activo();
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

  test('formularios de visita conservan una versión activa y respuestas históricas', async () => {
    await db.transaction(async (client) => {
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await client.query('SAVEPOINT duplicate_active_form');
      await expect(
        client.query(`
          INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo)
          VALUES (2, 1, 'Activo 1'), (2, 2, 'Activo 2')
        `)
      ).rejects.toMatchObject({ code: '23505' });
      await client.query('ROLLBACK TO SAVEPOINT duplicate_active_form');

      const version = await client.query(`
        INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo)
        VALUES (2, 1, 'Activo') RETURNING id
      `);
      await client.query('SAVEPOINT invalid_applies_to');
      await expect(
        client.query(
          `INSERT INTO bitacora_visit_form_fields
            (form_version_id, field_key, label, type, aplica_a)
           VALUES ($1, 'invalido', 'Inválido', 'text', 'MOTO')`,
          [version.rows[0].id]
        )
      ).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_applies_to');
      const field = await client.query(
        `INSERT INTO bitacora_visit_form_fields
          (form_version_id, field_key, label, type, required, sort_order)
         VALUES ($1, 'motivo', 'Motivo', 'text', TRUE, 1) RETURNING id`,
        [version.rows[0].id]
      );
      const tipo = await client.query(
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
         VALUES ($1, 'Vehículo', 1) RETURNING id`,
        [version.rows[0].id]
      );
      await client.query(
        'UPDATE bitacora_visit_form_versions SET published_at = CURRENT_TIMESTAMP WHERE id = $1',
        [version.rows[0].id]
      );
      const registro = await client.query(`
        INSERT INTO bitacora_registros
          (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
           ocurrido_at, detalle)
        VALUES (2, 1, 1, 1, 1, '2026-08-20 17:00:00', 'Ingreso visita')
        RETURNING id
      `);
      const visit = await client.query(
        `INSERT INTO bitacora_visitas
          (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
           visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
           registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
         VALUES (2, 1, 1, 1, $1, 'Carlos', '0912345678', '0991234567', $3, 'ABC123', 1, 1, $2)
         RETURNING id`,
        [version.rows[0].id, registro.rows[0].id, tipo.rows[0].id]
      );
      await client.query(
        `INSERT INTO bitacora_visita_respuestas
          (visita_id, form_field_id, field_key_snapshot, label_snapshot, type_snapshot, value_text, value_json)
         VALUES ($1, $2, 'motivo', 'Motivo anterior', 'text', 'Entrega', '"Entrega"'::jsonb)`,
        [visit.rows[0].id, field.rows[0].id]
      );
      await client.query(`
        UPDATE bitacora_visit_form_versions SET estado = 'ARCHIVED' WHERE ubicacion_id = 2;
        INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo, published_at)
        VALUES (2, 2, 'Activo nuevo', CURRENT_TIMESTAMP)
      `);
      const snapshot = await client.query(
        `SELECT label_snapshot, value_json
         FROM bitacora_visita_respuestas
         WHERE visita_id = $1`,
        [visit.rows[0].id]
      );
      expect(snapshot.rows[0]).toEqual({
        label_snapshot: 'Motivo anterior',
        value_json: 'Entrega',
      });
    });
  });

  test('DB rechaza edición, borrado y campos nuevos en formularios publicados', async () => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await client.query(`
        INSERT INTO clientes (id, nombre) VALUES (100, 'Cliente D6')
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO ubicaciones (id, nombre, cliente_id, tipo_punto)
        VALUES (101, 'Urbanización D6', 100, 'URBANIZACION')
          ON CONFLICT (id) DO NOTHING;
      `);
      const version = await client.query(`
        INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo)
        VALUES (101, 1, 'Activo') RETURNING id
      `);
      const field = await client.query(
        `INSERT INTO bitacora_visit_form_fields
          (form_version_id, field_key, label, type, required, sort_order)
         VALUES ($1, 'motivo', 'Motivo', 'text', TRUE, 1) RETURNING id`,
        [version.rows[0].id]
      );
      await client.query(
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
         VALUES ($1, 'Peatón', 1)`,
        [version.rows[0].id]
      );
      await client.query(
        'UPDATE bitacora_visit_form_versions SET published_at = CURRENT_TIMESTAMP WHERE id = $1',
        [version.rows[0].id]
      );

      const expectRejected = async (savepoint, query, params = []) => {
        await client.query(`SAVEPOINT ${savepoint}`);
        await expect(client.query(query, params)).rejects.toMatchObject({ code: '23514' });
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      };

      await expectRejected(
        'edit_form_title',
        'UPDATE bitacora_visit_form_versions SET titulo = $$Editado$$ WHERE id = $1',
        [version.rows[0].id]
      );
      await expectRejected(
        'edit_form_date_time_config',
        'UPDATE bitacora_visit_form_versions SET mostrar_fecha_hora = FALSE WHERE id = $1',
        [version.rows[0].id]
      );
      await expectRejected(
        'delete_form_version',
        'DELETE FROM bitacora_visit_form_versions WHERE id = $1',
        [version.rows[0].id]
      );
      await expectRejected(
        'add_form_field',
        `INSERT INTO bitacora_visit_form_fields
          (form_version_id, field_key, label, type, required, sort_order)
         VALUES ($1, 'extra', 'Extra', 'text', FALSE, 2)`,
        [version.rows[0].id]
      );
      await expectRejected(
        'edit_form_field',
        'UPDATE bitacora_visit_form_fields SET label = $$Editado$$ WHERE id = $1',
        [field.rows[0].id]
      );
      await expectRejected(
        'delete_form_field',
        'DELETE FROM bitacora_visit_form_fields WHERE id = $1',
        [field.rows[0].id]
      );
      await expectRejected(
        'add_form_tipo',
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
         VALUES ($1, 'Delivery', 2)`,
        [version.rows[0].id]
      );

      await expect(
        repository.softDeleteVisitFormVersion({ client, formId: version.rows[0].id })
      ).resolves.toBeNull();

      await expect(
        client.query(
          'UPDATE bitacora_visit_form_versions SET estado = $$ARCHIVED$$ WHERE id = $1',
          [version.rows[0].id]
        )
      ).resolves.toMatchObject({ rowCount: 1 });

      const softDeleted = await repository.softDeleteVisitFormVersion({
        client,
        formId: version.rows[0].id,
      });
      expect(softDeleted).toEqual(
        expect.objectContaining({ id: version.rows[0].id, estado: 'ARCHIVED' })
      );
      await expect(
        repository.findVisitFormVersionDetail({ formId: version.rows[0].id, executor: client })
      ).resolves.toBeNull();
      const preservedChildren = await client.query(
        'SELECT COUNT(*)::int AS total FROM bitacora_visit_form_fields WHERE form_version_id = $1',
        [version.rows[0].id]
      );
      expect(preservedChildren.rows[0].total).toBe(1);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });

  test('DB rechaza visitas con formulario o titular fuera de la Casa seleccionada', async () => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${schemaIdent}`);
      await client.query(`
        INSERT INTO clientes (id, nombre) VALUES (110, 'Cliente D6')
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO ubicaciones (id, nombre, cliente_id, tipo_punto)
        VALUES
          (111, 'Urbanización D6 A', 110, 'URBANIZACION'),
          (112, 'Urbanización D6 B', 110, 'URBANIZACION')
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO manzanas (id, ubicacion_id, nombre, estado)
        VALUES
          (111, 111, 'A', 'activo'),
          (112, 111, 'B', 'activo')
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO villas (id, manzana_id, identificador, estado)
        VALUES
          (111, 111, '1', 'activo'),
          (112, 112, '2', 'activo')
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO residentes (id, villa_id, nombre, contacto, es_principal, activo)
        VALUES
          (111, 111, 'Residente A', '0990000000', TRUE, TRUE),
          (112, 112, 'Residente B', '0991111111', TRUE, TRUE),
          (113, 111, 'Residente no titular', '0992222222', FALSE, TRUE)
          ON CONFLICT (id) DO NOTHING;
        INSERT INTO colaboradores (id, nombres_completos)
        VALUES (111, 'Guardia D6') ON CONFLICT (id) DO NOTHING;
        INSERT INTO usuarios (id, usuario, colaborador_id)
        VALUES (111, 'guardia_d6', 111) ON CONFLICT (id) DO NOTHING;
      `);
      const formA = await client.query(`
        INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo)
        VALUES (111, 1, 'Formulario A') RETURNING id
      `);
      const formB = await client.query(`
        INSERT INTO bitacora_visit_form_versions (ubicacion_id, version, titulo)
        VALUES (112, 1, 'Formulario B') RETURNING id
      `);
      const tipoA = await client.query(
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
         VALUES ($1, 'Vehículo', 1) RETURNING id`,
        [formA.rows[0].id]
      );
      const tipoAPeaton = await client.query(
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
         VALUES ($1, 'Peatón', 2) RETURNING id`,
        [formA.rows[0].id]
      );
      const tipoB = await client.query(
        `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
         VALUES ($1, 'Vehículo', 1) RETURNING id`,
        [formB.rows[0].id]
      );
      await client.query(
        `UPDATE bitacora_visit_form_versions SET published_at = CURRENT_TIMESTAMP
         WHERE id IN ($1, $2)`,
        [formA.rows[0].id, formB.rows[0].id]
      );
      const registro = await client.query(`
        INSERT INTO bitacora_registros
          (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
           ocurrido_at, detalle)
        VALUES (111, 111, 111, 111, 111, '2026-08-20 17:00:00', 'Ingreso visita')
        RETURNING id
      `);

      const insertVisit = ({ formVersionId, residentId, tipoVisitaId = tipoA.rows[0].id }) =>
        client.query(
          `INSERT INTO bitacora_visitas
            (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
             visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
             registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
           VALUES (111, 111, 111, $1, $2, 'Carlos', '0912345678', '0991234567', $4, 'ABC123', 111, 111, $3)`,
          [residentId, formVersionId, registro.rows[0].id, tipoVisitaId]
        );

      await expect(
        insertVisit({ formVersionId: formA.rows[0].id, residentId: 111 })
      ).resolves.toBeDefined();

      await client.query('SAVEPOINT invalid_visit_type');
      await expect(
        client.query(
          `INSERT INTO bitacora_visitas
            (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
             visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
             registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
           VALUES (111, 111, 111, 111, $1, 'Peatón', '0910000003', '0990000003', $3, NULL, 111, 111, $2)`,
          [formA.rows[0].id, registro.rows[0].id, tipoB.rows[0].id]
        )
      ).rejects.toMatchObject({ code: '23503' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_visit_type');

      await expect(
        client.query(
          `INSERT INTO bitacora_visitas
            (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
             visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
             registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
           VALUES (111, 111, 111, 111, $1, 'Peatón', '0910000000', '0990000000', $3, NULL, 111, 111, $2)`,
          [formA.rows[0].id, registro.rows[0].id, tipoAPeaton.rows[0].id]
        )
      ).resolves.toBeDefined();

      // Placa ya no está condicionada a un tipo hardcodeado: un tipo "Vehículo" ahora
      // acepta placa NULL sin violar ningún CHECK (la exigibilidad es responsabilidad
      // del campo configurable tipo "placa", no de una columna fija por tipo).
      await expect(
        client.query(
          `INSERT INTO bitacora_visitas
            (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
             visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
             registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
           VALUES (111, 111, 111, 111, $1, 'Conductor', '0910000001', '0990000001', $3, NULL, 111, 111, $2)`,
          [formA.rows[0].id, registro.rows[0].id, tipoA.rows[0].id]
        )
      ).resolves.toBeDefined();

      await client.query('SAVEPOINT invalid_visit_document');
      await expect(
        client.query(
          `INSERT INTO bitacora_visitas
            (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
             visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
             registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
           VALUES (111, 111, 111, 111, $1, 'Visitante', '09123A5678', '0990000002', $3, NULL, 111, 111, $2)`,
          [formA.rows[0].id, registro.rows[0].id, tipoAPeaton.rows[0].id]
        )
      ).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_visit_document');

      await client.query('SAVEPOINT invalid_visit_form');
      await expect(
        insertVisit({ formVersionId: formB.rows[0].id, residentId: 111 })
      ).rejects.toMatchObject({ code: '23503' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_visit_form');

      await client.query('SAVEPOINT invalid_visit_resident');
      await expect(
        insertVisit({ formVersionId: formA.rows[0].id, residentId: 112 })
      ).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_visit_resident');

      await client.query('SAVEPOINT invalid_visit_titular');
      await expect(
        insertVisit({ formVersionId: formA.rows[0].id, residentId: 113 })
      ).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_visit_titular');
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
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
    const inserted = await db.query(
      `INSERT INTO ${schemaIdent}.usuarios (usuario, colaborador_id)
       VALUES ('anulador', NULL)
       RETURNING id`
    );
    const userId = inserted.rows[0].id;
    await db.query(
      `UPDATE ${schemaIdent}.bitacora_registros
       SET estado = 'ANULADA',
           anulado_at = '2026-08-20 14:00:00',
           anulado_por_usuario_id = $1,
           motivo_anulacion = 'Corrección'
       WHERE id = 1`,
      [userId]
    );

    await expect(
      db.query(`DELETE FROM ${schemaIdent}.usuarios WHERE id = $1`, [userId])
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'bitacora_registros_anulado_por_usuario_id_fkey',
    });

    const preserved = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ${schemaIdent}.usuarios WHERE id = $1) AS usuarios,
         (SELECT COUNT(*)::int FROM ${schemaIdent}.bitacora_registros
          WHERE anulado_por_usuario_id = $1) AS registros`,
      [userId]
    );
    expect(preserved.rows[0]).toEqual({ usuarios: 1, registros: 1 });
  });
});
