-- ============================================
-- WESApp - Inventario Migration
-- Migration 011: Historial de bajas de articulos
-- ============================================

CREATE TABLE IF NOT EXISTS articulos_bajas (
    id SERIAL PRIMARY KEY,
    articulo_id INTEGER REFERENCES articulos(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
    fecha_baja TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_articulo VARCHAR(20),
    nombre_articulo VARCHAR(100),
    talla VARCHAR(10),
    marca VARCHAR(50),
    modelo VARCHAR(50),
    numero_serie VARCHAR(100),
    calibre VARCHAR(20),
    codigo_pantalla VARCHAR(50),
    codigo_radio VARCHAR(50),
    version VARCHAR(50),
    ubicacion_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
    ubicacion_nombre VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_articulos_bajas_fecha ON articulos_bajas(fecha_baja);
CREATE INDEX IF NOT EXISTS idx_articulos_bajas_articulo ON articulos_bajas(articulo_id);
CREATE INDEX IF NOT EXISTS idx_articulos_bajas_usuario ON articulos_bajas(usuario_id);

INSERT INTO schema_version (version, description)
VALUES (11, 'Historial de bajas de articulos')
ON CONFLICT (version) DO NOTHING;
