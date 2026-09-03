-- ============================================
-- WESApp - Unicidad case-insensitive de ubicaciones normalizadas
-- Migration 017
-- ============================================

BEGIN;

LOCK TABLE ubicaciones IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(TRIM(nombre)) AS nombre_normalizado
      FROM ubicaciones
      GROUP BY LOWER(TRIM(nombre))
      HAVING COUNT(*) > 1
    ) duplicadas
  ) THEN
    RAISE EXCEPTION 'No se puede crear unicidad case-insensitive: existen ubicaciones duplicadas por LOWER(TRIM(nombre)). Revise database/diagnostics/ubicaciones_duplicate_diagnostics.sql y corrija manualmente antes de desplegar.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_nombre_lower_unique
  ON ubicaciones (LOWER(TRIM(nombre)));

INSERT INTO schema_version (version, description)
VALUES (17, 'Case-insensitive unique normalized locations')
ON CONFLICT (version) DO NOTHING;

COMMIT;
