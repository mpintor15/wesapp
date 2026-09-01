-- WESApp - Persistencia del motivo de anulación de Visitas

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT NULL;

INSERT INTO schema_version (version, description)
VALUES (31, 'Persist visita cancellation reason')
ON CONFLICT (version) DO NOTHING;
