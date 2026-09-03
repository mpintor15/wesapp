-- WESApp - Asignaciones Guardia ↔ Ubicación

CREATE TABLE IF NOT EXISTS usuario_ubicaciones (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  PRIMARY KEY (usuario_id, ubicacion_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_ubicaciones_ubicacion_id
  ON usuario_ubicaciones (ubicacion_id);

INSERT INTO schema_version (version, description)
VALUES (22, 'Add Guardia-ubicacion assignments')
ON CONFLICT (version) DO NOTHING;
