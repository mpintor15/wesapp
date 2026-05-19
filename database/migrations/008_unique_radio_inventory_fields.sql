-- Código pantalla, número de serie de radio y versión deben ser únicos.
-- Estos índices permiten varios NULL, pero bloquean valores repetidos cuando existen.

CREATE UNIQUE INDEX IF NOT EXISTS uq_articulos_codigo_pantalla
ON articulos(codigo_pantalla)
WHERE codigo_pantalla IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_articulos_codigo_radio
ON articulos(codigo_radio)
WHERE codigo_radio IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_articulos_version
ON articulos(version)
WHERE version IS NOT NULL;

INSERT INTO schema_version (version, description)
VALUES (8, 'Campos de radio únicos en inventario')
ON CONFLICT (version) DO NOTHING;
