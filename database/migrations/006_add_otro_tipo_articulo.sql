-- ============================================
-- WESApp - Inventario Migration
-- Migration 006: Add "otro" inventory item type
-- ============================================

ALTER TABLE articulos
  DROP CONSTRAINT IF EXISTS articulos_tipo_articulo_check;

ALTER TABLE articulos
  ADD CONSTRAINT articulos_tipo_articulo_check
  CHECK (tipo_articulo IN ('equipo', 'placa_balistica', 'arma', 'radio', 'otro'));

INSERT INTO schema_version (version, description)
VALUES (6, 'Add otro type to inventory article type constraint')
ON CONFLICT (version) DO NOTHING;
