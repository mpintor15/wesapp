-- Observaciones opcionales de la visita: una al registrar el ingreso y otra al registrar la salida.
ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS observacion_ingreso TEXT NULL,
  ADD COLUMN IF NOT EXISTS observacion_salida TEXT NULL;

INSERT INTO schema_version (version, description)
VALUES (104, 'Agrega observaciones opcionales de ingreso y salida a las visitas')
ON CONFLICT (version) DO NOTHING;
