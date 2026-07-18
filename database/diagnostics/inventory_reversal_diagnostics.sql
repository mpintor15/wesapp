-- Diagnostico de reversibilidad de movimientos de inventario.
-- Solo lectura: no modifica datos.

WITH movement_base AS (
  SELECT
    m.id,
    COALESCE(m.estado, 'ACTIVO') AS estado,
    CASE
      WHEN COUNT(d.id) = 0 THEN 'sin_detalle'
      WHEN BOOL_AND(d.ubicacion_origen_id IS NULL) THEN 'entrada'
      WHEN BOOL_AND(d.ubicacion_destino_id IS NULL) THEN 'salida'
      ELSE 'traslado'
    END AS tipo_movimiento,
    COALESCE(m.reversion_datos_completos, FALSE) AS reversion_datos_completos,
    COUNT(e.id) AS efectos
  FROM movimientos m
  LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
  LEFT JOIN inventario_stock_efectos e ON e.movimiento_id = m.id
  GROUP BY m.id, m.estado, m.reversion_datos_completos
),
classified AS (
  SELECT
    *,
    CASE
      WHEN estado = 'ANULADO' THEN 'ALREADY_VOIDED'
      WHEN estado = 'ELIMINADO' THEN 'ADMINISTRATIVELY_DELETED'
      WHEN reversion_datos_completos = TRUE AND efectos > 0 THEN 'COMPLETE'
      ELSE 'INCOMPLETE'
    END AS reversal_status
  FROM movement_base
)
SELECT
  tipo_movimiento,
  estado,
  reversal_status,
  COUNT(*) AS total
FROM classified
GROUP BY tipo_movimiento, estado, reversal_status
ORDER BY tipo_movimiento, estado, reversal_status;
