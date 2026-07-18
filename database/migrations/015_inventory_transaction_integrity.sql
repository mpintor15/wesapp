-- ============================================
-- WESApp - Integridad transaccional de Inventario
-- Migration 015
-- ============================================

BEGIN;

LOCK TABLE articulos, movimientos, detalle_movimientos, articulos_bajas IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM articulos WHERE cantidad < 0) THEN
    RAISE EXCEPTION 'No se puede agregar chk_articulos_cantidad_non_negative: existen articulos con cantidad negativa';
  END IF;

  IF EXISTS (SELECT 1 FROM detalle_movimientos WHERE cantidad <= 0 OR cantidad IS NULL) THEN
    RAISE EXCEPTION 'No se puede agregar chk_detalle_movimientos_cantidad_positive: existen detalles con cantidad no positiva';
  END IF;
END $$;

ALTER TABLE articulos
  ADD COLUMN IF NOT EXISTS eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;

ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;

UPDATE movimientos SET estado = 'ACTIVO' WHERE estado IS NULL;

ALTER TABLE articulos_bajas
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS eliminado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;

UPDATE articulos_bajas SET estado = 'ACTIVO' WHERE estado IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.articulos'::regclass
      AND conname = 'chk_articulos_cantidad_non_negative'
  ) THEN
    ALTER TABLE articulos
      ADD CONSTRAINT chk_articulos_cantidad_non_negative CHECK (cantidad >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.detalle_movimientos'::regclass
      AND conname = 'chk_detalle_movimientos_cantidad_positive'
  ) THEN
    ALTER TABLE detalle_movimientos
      ADD CONSTRAINT chk_detalle_movimientos_cantidad_positive CHECK (cantidad > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.movimientos'::regclass
      AND conname = 'chk_movimientos_estado'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT chk_movimientos_estado CHECK (estado IN ('ACTIVO', 'ANULADO', 'ELIMINADO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.articulos_bajas'::regclass
      AND conname = 'chk_articulos_bajas_estado'
  ) THEN
    ALTER TABLE articulos_bajas
      ADD CONSTRAINT chk_articulos_bajas_estado CHECK (estado IN ('ACTIVO', 'ANULADO', 'ELIMINADO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movimientos_operativos_fecha
  ON movimientos(fecha_movimiento DESC)
  WHERE estado <> 'ELIMINADO';

CREATE INDEX IF NOT EXISTS idx_articulos_bajas_operativas_fecha
  ON articulos_bajas(fecha_baja DESC)
  WHERE estado <> 'ELIMINADO';

INSERT INTO schema_version (version, description)
VALUES (15, 'Inventory transactional integrity, voiding and logical deletion metadata')
ON CONFLICT (version) DO NOTHING;

COMMIT;
