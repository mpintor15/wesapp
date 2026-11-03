-- Revocación de sesiones JWT.
--  - usuarios.sesiones_validas_desde: tokens emitidos antes de esta marca dejan de
--    ser válidos (cambio o restablecimiento de contraseña).
--  - sesiones_revocadas: tokens individuales (jti) invalidados al cerrar sesión.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS sesiones_validas_desde TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS sesiones_revocadas (
  jti TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiones_revocadas_expira_at ON sesiones_revocadas (expira_at);

INSERT INTO schema_version (version, description)
VALUES (107, 'Agrega revocación de sesiones JWT por cierre de sesión y cambio de contraseña')
ON CONFLICT (version) DO NOTHING;
