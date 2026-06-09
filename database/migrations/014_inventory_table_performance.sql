-- ============================================
-- WESApp - Indices para tablas de Inventario
-- Migration 014
-- ============================================

BEGIN;

-- PostgreSQL no crea indices automaticamente para las columnas que referencian
-- claves foraneas. Estos indices aceleran el listado y detalle de movimientos.
CREATE INDEX IF NOT EXISTS idx_detalle_movimientos_movimiento
  ON detalle_movimientos(movimiento_id);

CREATE INDEX IF NOT EXISTS idx_detalle_movimientos_articulo
  ON detalle_movimientos(articulo_id);

CREATE INDEX IF NOT EXISTS idx_detalle_movimientos_destino
  ON detalle_movimientos(ubicacion_destino_id);

-- La vista de inventario solo muestra articulos activos y los ordena por fecha.
CREATE INDEX IF NOT EXISTS idx_articulos_activos_created_at
  ON articulos(created_at DESC)
  WHERE activo = TRUE;

INSERT INTO schema_version (version, description)
VALUES (14, 'Improve inventory table query performance')
ON CONFLICT (version) DO NOTHING;

COMMIT;
