/**
 * ensureSchema.js
 *
 * Idempotent production guard for databases that missed one or more
 * migrations. It only creates missing columns/tables/views used by the
 * current backend, so normal writes do not fail with schema-related 500s.
 */
const ensureSchema = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      tabla VARCHAR(100) NOT NULL,
      operacion VARCHAR(20) NOT NULL,
      registro_id VARCHAR(100),
      usuario_id INTEGER,
      usuario_nombre VARCHAR(100),
      datos_anteriores JSONB,
      datos_nuevos JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE IF EXISTS usuarios
      ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);
    ALTER TABLE IF EXISTS usuarios
      ADD COLUMN IF NOT EXISTS apellido VARCHAR(100);
    ALTER TABLE IF EXISTS usuarios
      ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
    UPDATE usuarios
    SET
      nombre = COALESCE(nombre, usuario),
      apellido = COALESCE(apellido, '')
    WHERE nombre IS NULL OR apellido IS NULL;

    ALTER TABLE IF EXISTS cuentas
      ADD COLUMN IF NOT EXISTS cancelada BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS cuentas
      ADD COLUMN IF NOT EXISTS detalle_anulacion TEXT;
    ALTER TABLE IF EXISTS cuentas
      ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP;
    ALTER TABLE IF EXISTS cuentas
      ADD COLUMN IF NOT EXISTS incluye_iva BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS cuentas
      ADD COLUMN IF NOT EXISTS incluye_retencion_fuente BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS cuentas
      ADD COLUMN IF NOT EXISTS incluye_retencion_iva BOOLEAN DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      metodo_pago VARCHAR(50),
      referencia VARCHAR(100),
      notas TEXT,
      total NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS referencia VARCHAR(100);
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS notas TEXT;
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0;
    ALTER TABLE IF EXISTS pagos
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    UPDATE pagos
    SET
      fecha = COALESCE(fecha, CURRENT_DATE),
      total = COALESCE(total, 0),
      created_at = COALESCE(created_at, fecha, CURRENT_TIMESTAMP)
    WHERE fecha IS NULL OR total IS NULL OR created_at IS NULL;

    ALTER TABLE IF EXISTS abonos
      ADD COLUMN IF NOT EXISTS pago_id INTEGER REFERENCES pagos(id) ON DELETE CASCADE;

    ALTER TABLE IF EXISTS articulos
      ADD COLUMN IF NOT EXISTS codigo_pantalla VARCHAR(50);
    ALTER TABLE IF EXISTS articulos
      ADD COLUMN IF NOT EXISTS codigo_radio VARCHAR(50);
    ALTER TABLE IF EXISTS articulos
      ADD COLUMN IF NOT EXISTS version VARCHAR(50);
    ALTER TABLE IF EXISTS articulos
      ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
    UPDATE articulos SET activo = TRUE WHERE activo IS NULL;

    ALTER TABLE IF EXISTS colaboradores
      ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo';
    UPDATE colaboradores SET estado = 'activo' WHERE estado IS NULL;

    DO $$
    BEGIN
      IF to_regclass('public.articulos') IS NOT NULL THEN
        ALTER TABLE articulos DROP CONSTRAINT IF EXISTS articulos_tipo_articulo_check;
        ALTER TABLE articulos
          ADD CONSTRAINT articulos_tipo_articulo_check
          CHECK (tipo_articulo IN ('equipo', 'placa_balistica', 'arma', 'radio', 'otro'));
      END IF;
    END $$;

    DO $$
    BEGIN
      IF to_regclass('public.articulos') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_articulos_codigo_pantalla')
           AND NOT EXISTS (
             SELECT 1
             FROM articulos
             WHERE codigo_pantalla IS NOT NULL
             GROUP BY codigo_pantalla
             HAVING COUNT(*) > 1
           ) THEN
          CREATE UNIQUE INDEX uq_articulos_codigo_pantalla
            ON articulos(codigo_pantalla)
            WHERE codigo_pantalla IS NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_articulos_codigo_radio')
           AND NOT EXISTS (
             SELECT 1
             FROM articulos
             WHERE codigo_radio IS NOT NULL
             GROUP BY codigo_radio
             HAVING COUNT(*) > 1
           ) THEN
          CREATE UNIQUE INDEX uq_articulos_codigo_radio
            ON articulos(codigo_radio)
            WHERE codigo_radio IS NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_articulos_version')
           AND NOT EXISTS (
             SELECT 1
             FROM articulos
             WHERE version IS NOT NULL
             GROUP BY version
             HAVING COUNT(*) > 1
           ) THEN
          CREATE UNIQUE INDEX uq_articulos_version
            ON articulos(version)
            WHERE version IS NOT NULL;
        END IF;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_abonos_pago ON abonos(pago_id);
    CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);

    DROP VIEW IF EXISTS vista_reporte_cuentas;
    CREATE VIEW vista_reporte_cuentas AS
    SELECT
      c.num_factura,
      c.cliente_id,
      cl.nombre AS cliente,
      cl.identificacion,
      c.fecha_factura,
      c.cancelada,
      c.detalle_anulacion,
      c.fecha_anulacion,
      c.incluye_iva,
      c.incluye_retencion_fuente,
      c.incluye_retencion_iva,
      c.valor_factura AS subtotal,
      CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END AS iva,
      CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END AS retencion_fuente,
      CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END AS retencion_iva,
      (
        c.valor_factura
        + CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
      ) AS por_cobrar,
      COALESCE(SUM(a.valor_abono), 0) AS total_abonos,
      (
        c.valor_factura
        + CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
        - COALESCE(SUM(a.valor_abono), 0)
      ) AS saldo_pendiente
    FROM cuentas c
    JOIN clientes cl ON c.cliente_id = cl.id
    LEFT JOIN abonos a ON c.num_factura = a.num_factura
    GROUP BY
      c.num_factura,
      c.cliente_id,
      cl.nombre,
      cl.identificacion,
      c.fecha_factura,
      c.cancelada,
      c.detalle_anulacion,
      c.fecha_anulacion,
      c.incluye_iva,
      c.incluye_retencion_fuente,
      c.incluye_retencion_iva,
      c.valor_factura;

    DROP VIEW IF EXISTS vista_inventario_alertas;
    CREATE VIEW vista_inventario_alertas AS
    SELECT
      a.id,
      a.tipo_articulo,
      a.nombre_articulo,
      a.cantidad,
      a.talla,
      a.marca,
      a.modelo,
      a.numero_serie,
      a.calibre,
      a.fecha_caducidad,
      a.codigo_pantalla,
      a.codigo_radio,
      a.version,
      a.ubicacion_id,
      a.created_at,
      a.updated_at,
      a.activo,
      u.nombre AS ubicacion_nombre,
      CASE
        WHEN a.fecha_caducidad IS NULL THEN 'sin_alerta'
        WHEN a.fecha_caducidad < CURRENT_DATE THEN 'vencida'
        WHEN a.fecha_caducidad <= CURRENT_DATE + INTERVAL '30 days' THEN 'proxima_a_vencer'
        ELSE 'vigente'
      END AS estado_caducidad
    FROM articulos a
    LEFT JOIN ubicaciones u ON a.ubicacion_id = u.id
    WHERE a.activo = TRUE;

    INSERT INTO schema_version (version, description)
    VALUES
      (2, 'Ensure audit/schema version support'),
      (3, 'Ensure pagos table and abonos link'),
      (6, 'Ensure otro inventory type'),
      (7, 'Ensure inventory alert view fields'),
      (8, 'Ensure unique radio inventory fields'),
      (9, 'Ensure user name fields'),
      (10, 'Ensure cuentas production columns')
    ON CONFLICT (version) DO NOTHING;
  `);
};

module.exports = { ensureSchema };
