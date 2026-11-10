-- Accesos por cuenta de módulo: { "<tab>": "ver" | "editar" }. NULL = permisos del rol.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS accesos_cuenta JSONB;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_accesos_cuenta_check;
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_accesos_cuenta_check
  CHECK (accesos_cuenta IS NULL OR (es_cuenta_compartida AND jsonb_typeof(accesos_cuenta) = 'object'));

INSERT INTO schema_version (version, description)
VALUES (109, 'Agrega usuarios.accesos_cuenta para elegir módulos, tabs y nivel de acceso de cuentas de módulo')
ON CONFLICT (version) DO NOTHING;
