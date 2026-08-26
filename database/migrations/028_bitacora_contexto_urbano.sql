-- WESApp - Contexto urbano opcional para registros de Bitácora

ALTER TABLE manzanas
  ADD CONSTRAINT manzanas_id_ubicacion_id_key UNIQUE (id, ubicacion_id);

ALTER TABLE villas
  ADD CONSTRAINT villas_id_manzana_id_key UNIQUE (id, manzana_id);

ALTER TABLE bitacora_registros
  ADD COLUMN manzana_id INTEGER NULL,
  ADD COLUMN villa_id INTEGER NULL,
  ADD CONSTRAINT bitacora_registros_villa_requiere_manzana_check
    CHECK (villa_id IS NULL OR manzana_id IS NOT NULL),
  ADD CONSTRAINT bitacora_registros_manzana_ubicacion_fkey
    FOREIGN KEY (manzana_id, ubicacion_id)
    REFERENCES manzanas (id, ubicacion_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT bitacora_registros_villa_manzana_fkey
    FOREIGN KEY (villa_id, manzana_id)
    REFERENCES villas (id, manzana_id)
    ON DELETE RESTRICT;

CREATE INDEX idx_bitacora_registros_manzana_ubicacion
  ON bitacora_registros (manzana_id, ubicacion_id)
  WHERE manzana_id IS NOT NULL;

CREATE INDEX idx_bitacora_registros_villa_manzana
  ON bitacora_registros (villa_id, manzana_id)
  WHERE villa_id IS NOT NULL;

INSERT INTO schema_version (version, description)
VALUES (28, 'Add optional urban context to logbook records')
ON CONFLICT (version) DO NOTHING;
