-- Bloqueo temporal de cuenta tras intentos de login fallidos consecutivos.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ NULL;

INSERT INTO schema_version (version, description)
VALUES (45, 'Agrega contador de intentos fallidos y bloqueo temporal de login por usuario')
ON CONFLICT (version) DO NOTHING;
