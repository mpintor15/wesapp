-- Asegura columnas usadas por Cuentas en instalaciones que no recibieron todas las migraciones.

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE pagos
SET created_at = COALESCE(created_at, fecha, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS cancelada BOOLEAN DEFAULT FALSE;

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS detalle_anulacion TEXT;

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP;

CREATE OR REPLACE VIEW vista_reporte_cuentas AS
SELECT
    c.num_factura,
    c.cliente_id,
    cl.nombre AS cliente,
    cl.identificacion,
    c.fecha_factura,
    c.cancelada,
    c.detalle_anulacion,
    c.fecha_anulacion,
    c.incluye_iva,
    c.incluye_retencion_fuente,
    c.incluye_retencion_iva,
    c.valor_factura AS subtotal,
    CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END AS iva,
    CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END AS retencion_fuente,
    CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END AS retencion_iva,
    (
        c.valor_factura
        + CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
    ) AS por_cobrar,
    COALESCE(SUM(a.valor_abono), 0) AS total_abonos,
    (
        c.valor_factura
        + CASE WHEN c.incluye_iva THEN ROUND(c.valor_factura * 0.15, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_fuente THEN ROUND(c.valor_factura * 0.03, 2) ELSE 0 END
        - CASE WHEN c.incluye_retencion_iva AND c.incluye_iva THEN ROUND(c.valor_factura * 0.15 * 0.70, 2) ELSE 0 END
        - COALESCE(SUM(a.valor_abono), 0)
    ) AS saldo_pendiente
FROM cuentas c
JOIN clientes cl ON c.cliente_id = cl.id
LEFT JOIN abonos a ON c.num_factura = a.num_factura
GROUP BY c.num_factura, c.cliente_id, cl.nombre, cl.identificacion, c.fecha_factura, c.valor_factura,
         c.cancelada, c.detalle_anulacion, c.fecha_anulacion,
         c.incluye_iva, c.incluye_retencion_fuente, c.incluye_retencion_iva;

INSERT INTO schema_version (version, description)
VALUES (10, 'Ensure production columns for cuentas and pagos')
ON CONFLICT (version) DO NOTHING;
