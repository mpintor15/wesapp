ALTER TABLE bitacora_visit_form_versions
  ADD COLUMN IF NOT EXISTS mostrar_casa BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_version (version, description)
VALUES (44, 'Permite configurar la pregunta Casa por formulario de visitas')
ON CONFLICT (version) DO NOTHING;
