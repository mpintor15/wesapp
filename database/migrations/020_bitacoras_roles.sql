-- WESApp - Roles base para Bitácoras

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_tipo_usuario_check
  CHECK (tipo_usuario IN (
    'gerente',
    'secretario',
    'supervisor',
    'contador',
    'guardia',
    'monitorista'
  ));

INSERT INTO schema_version (version, description)
VALUES (20, 'Add Guardia and Monitorista user roles')
ON CONFLICT (version) DO NOTHING;
