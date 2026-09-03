-- WESApp - Visitas urbanas versionadas para Bitácoras

CREATE TABLE IF NOT EXISTS bitacora_visit_form_versions (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  titulo VARCHAR(150) NOT NULL DEFAULT 'Formulario de visitas',
  estado VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (estado IN ('ACTIVE', 'ARCHIVED')),
  created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  published_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  CONSTRAINT bitacora_visit_form_versions_unique_version UNIQUE (ubicacion_id, version),
  CONSTRAINT bitacora_visit_form_versions_id_ubicacion_unique UNIQUE (id, ubicacion_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bitacora_visit_form_versions_one_active
  ON bitacora_visit_form_versions (ubicacion_id)
  WHERE estado = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_versions_ubicacion
  ON bitacora_visit_form_versions (ubicacion_id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_fields (
  id SERIAL PRIMARY KEY,
  form_version_id INTEGER NOT NULL REFERENCES bitacora_visit_form_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  type VARCHAR(12) NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_fields_unique_key UNIQUE (form_version_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_fields_version
  ON bitacora_visit_form_fields (form_version_id, sort_order, id);

ALTER TABLE residentes
  ADD CONSTRAINT residentes_id_villa_unique UNIQUE (id, villa_id);

CREATE TABLE IF NOT EXISTS bitacora_visitas (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  manzana_id INTEGER NOT NULL,
  villa_id INTEGER NOT NULL,
  residente_principal_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  visitante_nombre VARCHAR(150) NOT NULL,
  visitante_documento VARCHAR(80) NOT NULL,
  visitante_telefono VARCHAR(80) NOT NULL,
  tipo_ingreso VARCHAR(10) NOT NULL CHECK (tipo_ingreso IN ('PEATONAL', 'VEHICULO')),
  placa VARCHAR(30) NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA', 'ANULADA')),
  entrada_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  salida_at TIMESTAMP NULL,
  registrado_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  registrado_por_colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cerrado_por_usuario_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cerrado_por_colaborador_id INTEGER REFERENCES colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entrada_bitacora_registro_id INTEGER REFERENCES bitacora_registros(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  salida_bitacora_registro_id INTEGER REFERENCES bitacora_registros(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bitacora_visitas_manzana_ubicacion_fkey
    FOREIGN KEY (manzana_id, ubicacion_id) REFERENCES manzanas(id, ubicacion_id) ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_villa_manzana_fkey
    FOREIGN KEY (villa_id, manzana_id) REFERENCES villas(id, manzana_id) ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_residente_villa_fkey
    FOREIGN KEY (residente_principal_id, villa_id) REFERENCES residentes(id, villa_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_form_ubicacion_fkey
    FOREIGN KEY (form_version_id, ubicacion_id) REFERENCES bitacora_visit_form_versions(id, ubicacion_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visitas_placa_por_tipo_check
    CHECK (tipo_ingreso = 'PEATONAL' OR (placa IS NOT NULL AND BTRIM(placa) <> '')),
  CONSTRAINT bitacora_visitas_cedula_check
    CHECK (visitante_documento ~ '^[0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_ubicacion_estado
  ON bitacora_visitas (ubicacion_id, estado, entrada_at DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_casa
  ON bitacora_visitas (manzana_id, villa_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_placa
  ON bitacora_visitas (LOWER(placa));

CREATE TABLE IF NOT EXISTS bitacora_visita_respuestas (
  id SERIAL PRIMARY KEY,
  visita_id INTEGER NOT NULL REFERENCES bitacora_visitas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_field_id INTEGER NOT NULL REFERENCES bitacora_visit_form_fields(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  field_key_snapshot VARCHAR(80) NOT NULL,
  label_snapshot VARCHAR(120) NOT NULL,
  type_snapshot VARCHAR(12) NOT NULL,
  value_text TEXT NULL,
  value_json JSONB NULL,
  CONSTRAINT bitacora_visita_respuestas_unique_field UNIQUE (visita_id, form_field_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visita_respuestas_visita
  ON bitacora_visita_respuestas (visita_id);

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_urbanizacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ubicaciones
    WHERE id = NEW.ubicacion_id AND tipo_punto = 'URBANIZACION'
  ) THEN
    RAISE EXCEPTION 'Los formularios de visita solo pertenecen a ubicaciones URBANIZACION'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_urbanizacion_trigger ON bitacora_visit_form_versions;
CREATE TRIGGER enforce_bitacora_visit_form_urbanizacion_trigger
  BEFORE INSERT OR UPDATE OF ubicacion_id ON bitacora_visit_form_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_urbanizacion();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_version_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los formularios de visita publicados no se pueden eliminar'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ARCHIVED'
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at
     AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ACTIVE'
     AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW.ubicacion_id = OLD.ubicacion_id
     AND NEW.version = OLD.version
     AND NEW.titulo = OLD.titulo
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_version_lifecycle_trigger ON bitacora_visit_form_versions;
CREATE TRIGGER enforce_bitacora_visit_form_version_lifecycle_trigger
  BEFORE UPDATE OR DELETE ON bitacora_visit_form_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_version_lifecycle();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_field_immutability()
RETURNS TRIGGER AS $$
DECLARE
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se pueden agregar campos a un formulario de visita publicado'
      USING ERRCODE = '23514';
  END IF;

  RAISE EXCEPTION 'Los campos de formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_field_immutability_trigger ON bitacora_visit_form_fields;
CREATE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_fields
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_field_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visita_titular_activo()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM residentes
    WHERE id = NEW.residente_principal_id
      AND villa_id = NEW.villa_id
      AND es_principal = TRUE
      AND activo = TRUE
  ) THEN
    RAISE EXCEPTION 'La visita debe apuntar al titular activo de la Villa'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visita_titular_activo_trigger ON bitacora_visitas;
CREATE TRIGGER enforce_bitacora_visita_titular_activo_trigger
  BEFORE INSERT OR UPDATE OF residente_principal_id, villa_id ON bitacora_visitas
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visita_titular_activo();

DROP TRIGGER IF EXISTS update_bitacora_visitas_updated_at ON bitacora_visitas;
CREATE TRIGGER update_bitacora_visitas_updated_at BEFORE UPDATE ON bitacora_visitas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_version (version, description)
VALUES (29, 'Add versioned urbanization visit forms and visits')
ON CONFLICT (version) DO NOTHING;
