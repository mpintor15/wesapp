-- WESApp - Tipo de punto para ubicaciones existentes

ALTER TABLE ubicaciones
  ADD COLUMN IF NOT EXISTS tipo_punto VARCHAR(20) NOT NULL DEFAULT 'GENERAL';

ALTER TABLE ubicaciones
  DROP CONSTRAINT IF EXISTS ubicaciones_tipo_punto_check;

ALTER TABLE ubicaciones
  ADD CONSTRAINT ubicaciones_tipo_punto_check
  CHECK (tipo_punto IN ('GENERAL', 'URBANIZACION'));

INSERT INTO schema_version (version, description)
VALUES (23, 'Add location point type')
ON CONFLICT (version) DO NOTHING;
