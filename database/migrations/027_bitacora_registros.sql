-- WESApp - Persistencia mínima del núcleo de Bitácoras

CREATE TABLE bitacora_registros (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
  autor_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  autor_colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  ocurrido_at TIMESTAMP NOT NULL,
  detalle TEXT NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'REGISTRADA',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  anulado_at TIMESTAMP NULL,
  anulado_por_usuario_id INTEGER NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  motivo_anulacion TEXT NULL,
  CONSTRAINT bitacora_registros_detalle_no_vacio_check
    CHECK (detalle ~ '[^[:space:]]'),
  CONSTRAINT bitacora_registros_estado_check
    CHECK (estado IN ('REGISTRADA', 'ANULADA')),
  CONSTRAINT bitacora_registros_anulacion_coherente_check
    CHECK (
      (
        estado = 'REGISTRADA'
        AND anulado_at IS NULL
        AND anulado_por_usuario_id IS NULL
        AND motivo_anulacion IS NULL
      )
      OR
      (
        estado = 'ANULADA'
        AND anulado_at IS NOT NULL
        AND anulado_por_usuario_id IS NOT NULL
        AND motivo_anulacion IS NOT NULL
        AND motivo_anulacion ~ '[^[:space:]]'
      )
    )
);

CREATE INDEX idx_bitacora_registros_ubicacion_ocurrido
  ON bitacora_registros (ubicacion_id, ocurrido_at DESC, id DESC);

CREATE INDEX idx_bitacora_registros_autor_ocurrido
  ON bitacora_registros (autor_usuario_id, ocurrido_at DESC, id DESC);

CREATE INDEX idx_bitacora_registros_ocurrido
  ON bitacora_registros (ocurrido_at DESC, id DESC);

CREATE INDEX idx_bitacora_registros_estado_ocurrido
  ON bitacora_registros (estado, ocurrido_at DESC, id DESC);

INSERT INTO schema_version (version, description)
VALUES (27, 'Add minimal immutable logbook records persistence')
ON CONFLICT (version) DO NOTHING;
