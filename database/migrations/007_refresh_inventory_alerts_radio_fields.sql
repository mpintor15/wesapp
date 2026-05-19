-- ============================================
-- WESApp - Inventario Migration
-- Migration 007: Ensure radio fields are exposed in inventory view
-- ============================================

ALTER TABLE articulos ADD COLUMN IF NOT EXISTS codigo_pantalla VARCHAR(50);
ALTER TABLE articulos ADD COLUMN IF NOT EXISTS codigo_radio VARCHAR(50);
ALTER TABLE articulos ADD COLUMN IF NOT EXISTS version VARCHAR(50);
ALTER TABLE articulos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
UPDATE articulos SET activo = TRUE WHERE activo IS NULL;
UPDATE articulos SET numero_serie = NULL WHERE tipo_articulo = 'radio';

DROP VIEW IF EXISTS vista_inventario_alertas;

CREATE VIEW vista_inventario_alertas AS
SELECT
    a.id,
    a.tipo_articulo,
    a.nombre_articulo,
    a.cantidad,
    a.talla,
    a.marca,
    a.modelo,
    a.numero_serie,
    a.calibre,
    a.fecha_caducidad,
    a.codigo_pantalla,
    a.codigo_radio,
    a.version,
    a.ubicacion_id,
    a.created_at,
    a.updated_at,
    a.activo,
    u.nombre AS ubicacion_nombre,
    CASE
        WHEN a.fecha_caducidad IS NULL THEN 'sin_alerta'
        WHEN a.fecha_caducidad < CURRENT_DATE THEN 'vencida'
        WHEN a.fecha_caducidad <= CURRENT_DATE + INTERVAL '30 days' THEN 'proxima_a_vencer'
        ELSE 'vigente'
    END AS estado_caducidad
FROM articulos a
LEFT JOIN ubicaciones u ON a.ubicacion_id = u.id
WHERE a.activo = TRUE;

INSERT INTO schema_version (version, description)
VALUES (7, 'Expose radio fields in inventory alerts view')
ON CONFLICT (version) DO NOTHING;
