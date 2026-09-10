-- La placa fija fue reemplazada por preguntas configurables y debe ser opcional.
ALTER TABLE bitacora_visitas ALTER COLUMN placa DROP NOT NULL;

INSERT INTO schema_version (version, description)
VALUES (43, 'Hace opcional la placa legacy en visitas con formularios dinámicos')
ON CONFLICT (version) DO NOTHING;
