-- ============================================
-- WESApp - Usuarios: nombre y apellido
-- Migration 009: Add nombre and apellido columns to usuarios
-- ============================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS nombre  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS apellido VARCHAR(100);

INSERT INTO schema_version (version, description)
VALUES (9, 'Add nombre and apellido columns to usuarios')
ON CONFLICT (version) DO NOTHING;
