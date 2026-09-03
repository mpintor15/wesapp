BEGIN;

ALTER TABLE clientes
    DROP CONSTRAINT IF EXISTS clientes_nombre_key;

ALTER TABLE ubicaciones
    DROP CONSTRAINT IF EXISTS ubicaciones_nombre_key;

ALTER TABLE ubicaciones
    ADD COLUMN IF NOT EXISTS cliente_id INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_ubicaciones_cliente'
          AND conrelid = 'public.ubicaciones'::regclass
    ) THEN
        ALTER TABLE ubicaciones
            ADD CONSTRAINT fk_ubicaciones_cliente
            FOREIGN KEY (cliente_id)
            REFERENCES clientes(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END
$$;

DROP INDEX IF EXISTS public.idx_ubicaciones_nombre_lower_unique;

CREATE INDEX IF NOT EXISTS idx_ubicaciones_cliente_id
    ON ubicaciones (cliente_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_cliente_nombre_lower_unique
    ON ubicaciones (
        cliente_id,
        LOWER(TRIM(nombre))
    )
    WHERE cliente_id IS NOT NULL;

CREATE OR REPLACE VIEW vista_inventario_alertas AS
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
        WHEN a.fecha_caducidad <= CURRENT_DATE + INTERVAL '30 days'
            THEN 'proxima_a_vencer'
        ELSE 'vigente'
    END AS estado_caducidad,
    u.cliente_id,
    c.nombre AS cliente_nombre
FROM articulos a
LEFT JOIN ubicaciones u
    ON a.ubicacion_id = u.id
LEFT JOIN clientes c
    ON c.id = u.cliente_id
WHERE a.activo = TRUE;

INSERT INTO schema_version (
    version,
    description
)
VALUES (
    19,
    'Relate locations to clients with nullable cliente_id'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
