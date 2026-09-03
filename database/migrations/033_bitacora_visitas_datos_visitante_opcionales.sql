-- WESApp - Datos fijos del visitante pasan a ser opcionales en Bitácoras > Visitas
--
-- El registro de visita deja de exigir Visitante/Cédula/Teléfono como
-- columnas fijas obligatorias. Esos datos ahora se capturan, si el
-- formulario activo los define, como preguntas configurables (tipo texto o
-- cédula) y viven en bitacora_visitas.form_version_id -> respuestas, igual
-- que ya ocurre con placa desde la migración 032 (columna opcional, cuya
-- exigibilidad queda a cargo del campo configurable correspondiente).

ALTER TABLE bitacora_visitas
  ALTER COLUMN visitante_nombre DROP NOT NULL,
  ALTER COLUMN visitante_documento DROP NOT NULL,
  ALTER COLUMN visitante_telefono DROP NOT NULL;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_cedula_check;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_cedula_check
  CHECK (visitante_documento IS NULL OR visitante_documento ~ '^[0-9]{10}$');

INSERT INTO schema_version (version, description)
VALUES (33, 'Make bitacora_visitas visitor name/document/phone optional, matching placa')
ON CONFLICT (version) DO NOTHING;
