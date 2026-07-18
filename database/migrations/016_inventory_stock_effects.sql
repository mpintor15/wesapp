-- ============================================
-- WESApp - Efectos exactos de stock de Inventario
-- Migration 016
-- ============================================

BEGIN;

LOCK TABLE movimientos, articulos_bajas, articulos IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  table_exists BOOLEAN;
  incompatible TEXT;
BEGIN
  SELECT to_regclass('public.inventario_stock_efectos') IS NOT NULL INTO table_exists;

  IF table_exists THEN
    WITH required_columns(column_name, data_type, is_nullable) AS (
      VALUES
        ('id', 'integer', 'NO'),
        ('movimiento_id', 'integer', 'YES'),
        ('baja_id', 'integer', 'YES'),
        ('articulo_id', 'integer', 'NO'),
        ('delta', 'integer', 'NO'),
        ('stock_anterior', 'integer', 'YES'),
        ('stock_posterior', 'integer', 'YES'),
        ('ubicacion_anterior_id', 'integer', 'YES'),
        ('ubicacion_posterior_id', 'integer', 'YES'),
        ('creado_en', 'timestamp without time zone', 'YES')
    )
    SELECT string_agg(r.column_name, ', ' ORDER BY r.column_name)
    INTO incompatible
    FROM required_columns r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = 'inventario_stock_efectos'
     AND c.column_name = r.column_name
    WHERE c.column_name IS NULL
       OR c.data_type <> r.data_type
       OR c.is_nullable <> r.is_nullable;

    IF incompatible IS NOT NULL THEN
      RAISE EXCEPTION 'inventario_stock_efectos existe con columnas incompatibles: %', incompatible;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.inventario_stock_efectos'::regclass
        AND contype = 'p'
    ) THEN
      RAISE EXCEPTION 'inventario_stock_efectos existe sin clave primaria requerida';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.inventario_stock_efectos'::regclass
        AND conname = 'chk_inventario_stock_efectos_owner'
    ) THEN
      RAISE EXCEPTION 'inventario_stock_efectos existe sin chk_inventario_stock_efectos_owner';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.inventario_stock_efectos'::regclass
        AND conname = 'chk_inventario_stock_efectos_change'
    ) THEN
      RAISE EXCEPTION 'inventario_stock_efectos existe sin chk_inventario_stock_efectos_change';
    END IF;
  ELSE
    CREATE TABLE inventario_stock_efectos (
      id SERIAL PRIMARY KEY,
      movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE,
      baja_id INTEGER REFERENCES articulos_bajas(id) ON DELETE CASCADE,
      articulo_id INTEGER NOT NULL REFERENCES articulos(id),
      delta INTEGER NOT NULL,
      stock_anterior INTEGER,
      stock_posterior INTEGER,
      ubicacion_anterior_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
      ubicacion_posterior_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_inventario_stock_efectos_owner CHECK (
        (movimiento_id IS NOT NULL AND baja_id IS NULL)
        OR (movimiento_id IS NULL AND baja_id IS NOT NULL)
      ),
      CONSTRAINT chk_inventario_stock_efectos_change CHECK (
        delta <> 0 OR ubicacion_anterior_id IS DISTINCT FROM ubicacion_posterior_id
      )
    );
  END IF;
END $$;

ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS reversion_datos_completos BOOLEAN DEFAULT FALSE;

ALTER TABLE articulos_bajas
  ADD COLUMN IF NOT EXISTS reversion_datos_completos BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'movimientos'
      AND column_name = 'reversion_datos_completos'
      AND data_type <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'movimientos.reversion_datos_completos existe con tipo incompatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'articulos_bajas'
      AND column_name = 'reversion_datos_completos'
      AND data_type <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'articulos_bajas.reversion_datos_completos existe con tipo incompatible';
  END IF;
END $$;

INSERT INTO inventario_stock_efectos (
  baja_id,
  articulo_id,
  delta,
  stock_anterior,
  stock_posterior,
  ubicacion_anterior_id,
  ubicacion_posterior_id
)
SELECT
  b.id,
  b.articulo_id,
  -b.cantidad,
  NULL,
  NULL,
  b.ubicacion_id,
  b.ubicacion_id
FROM articulos_bajas b
WHERE b.articulo_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM inventario_stock_efectos e
    WHERE e.baja_id = b.id
  );

UPDATE articulos_bajas b
SET reversion_datos_completos = TRUE
WHERE b.articulo_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM inventario_stock_efectos e
    WHERE e.baja_id = b.id
  );

UPDATE movimientos
SET reversion_datos_completos = FALSE
WHERE reversion_datos_completos IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventario_stock_efectos_movimiento
  ON inventario_stock_efectos(movimiento_id);

CREATE INDEX IF NOT EXISTS idx_inventario_stock_efectos_baja
  ON inventario_stock_efectos(baja_id);

CREATE INDEX IF NOT EXISTS idx_inventario_stock_efectos_articulo
  ON inventario_stock_efectos(articulo_id);

INSERT INTO schema_version (version, description)
VALUES (16, 'Inventory exact stock effects and reversible history markers')
ON CONFLICT (version) DO NOTHING;

COMMIT;
