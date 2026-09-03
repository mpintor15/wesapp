-- WESApp - Grupos repetibles de personas en formularios de visitas
--
-- Permite que una pregunta del formulario represente un grupo de registros
-- repetible (ej. "Visitantes": Nombre, Cédula, Teléfono), en lugar de un
-- único campo escalar. La definición del grupo (y sus campos internos)
-- vive congelada junto con la versión publicada, igual que
-- bitacora_visit_form_fields/tipos/field_tipos. Las respuestas de cada
-- persona registrada en una visita se guardan como una fila por persona
-- (entry_index 1, 2, 3...), con sus respuestas como snapshot JSONB —mismo
-- principio de snapshot que bitacora_visita_respuestas, pero agrupado por
-- registro en vez de por campo, porque cada registro es una repetición
-- variable del mismo conjunto de campos.

CREATE TABLE IF NOT EXISTS bitacora_visit_form_groups (
  id SERIAL PRIMARY KEY,
  form_version_id INTEGER NOT NULL REFERENCES bitacora_visit_form_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  group_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  min_count SMALLINT NOT NULL DEFAULT 0 CHECK (min_count IN (0, 1)),
  aplica_a VARCHAR(20) NOT NULL DEFAULT 'TODOS' CHECK (aplica_a IN ('TODOS', 'SELECCIONADOS')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_groups_unique_key UNIQUE (form_version_id, group_key),
  CONSTRAINT bitacora_visit_form_groups_id_version_unique UNIQUE (id, form_version_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_groups_version
  ON bitacora_visit_form_groups (form_version_id, sort_order, id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_group_fields (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  type VARCHAR(12) NOT NULL CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_group_fields_unique_key UNIQUE (group_id, field_key),
  CONSTRAINT bitacora_visit_form_group_fields_group_fkey
    FOREIGN KEY (group_id, form_version_id)
    REFERENCES bitacora_visit_form_groups (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_group_fields_group
  ON bitacora_visit_form_group_fields (group_id, sort_order, id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_group_tipos (
  group_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  tipo_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, tipo_id),
  CONSTRAINT bitacora_visit_form_group_tipos_group_fkey
    FOREIGN KEY (group_id, form_version_id)
    REFERENCES bitacora_visit_form_groups (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visit_form_group_tipos_tipo_fkey
    FOREIGN KEY (tipo_id, form_version_id)
    REFERENCES bitacora_visit_form_tipos (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_group_tipos_tipo
  ON bitacora_visit_form_group_tipos (tipo_id);

-- Inmutabilidad: mismo patrón que enforce_bitacora_visit_form_field_immutability
-- (migración 029) y enforce_bitacora_visit_form_tipo_immutability /
-- enforce_bitacora_visit_form_field_tipo_immutability (migración 032).

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_group_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar grupos a un formulario de visita publicado'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'Los grupos de formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_group_immutability_trigger ON bitacora_visit_form_groups;
CREATE TRIGGER enforce_bitacora_visit_form_group_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_groups
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_group_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_group_field_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar campos a un grupo de un formulario publicado'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'Los campos de grupos de formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_group_field_immutability_trigger ON bitacora_visit_form_group_fields;
CREATE TRIGGER enforce_bitacora_visit_form_group_field_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_group_fields
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_group_field_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_group_tipo_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden asignar tipos de visita a grupos de un formulario publicado'
      USING ERRCODE = '23514';
  END IF;
  RAISE EXCEPTION 'La asignación de tipos de visita a grupos publicados es inmutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_group_tipo_immutability_trigger ON bitacora_visit_form_group_tipos;
CREATE TRIGGER enforce_bitacora_visit_form_group_tipo_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_group_tipos
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_group_tipo_immutability();

-- Registros de personas capturadas por un grupo repetible en una visita.
-- Una fila por persona (entry_index 1, 2, 3...); las respuestas de esa
-- persona quedan congeladas como snapshot JSONB (array de
-- {field_key,label,type,value}), igual que ya se hace fila-a-fila en
-- bitacora_visita_respuestas. No lleva trigger de inmutabilidad: como esa
-- tabla, el backend solo inserta (nunca actualiza) una vez creada la visita.

CREATE TABLE IF NOT EXISTS bitacora_visita_grupo_registros (
  id SERIAL PRIMARY KEY,
  visita_id INTEGER NOT NULL REFERENCES bitacora_visitas(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  group_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  group_key_snapshot VARCHAR(80) NOT NULL,
  label_snapshot VARCHAR(120) NOT NULL,
  entry_index INTEGER NOT NULL CHECK (entry_index >= 1),
  respuestas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bitacora_visita_grupo_registros_unique_entry UNIQUE (visita_id, group_id, entry_index),
  CONSTRAINT bitacora_visita_grupo_registros_group_fkey
    FOREIGN KEY (group_id, form_version_id)
    REFERENCES bitacora_visit_form_groups (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visita_grupo_registros_visita
  ON bitacora_visita_grupo_registros (visita_id, group_id, entry_index);

INSERT INTO schema_version (version, description)
VALUES (34, 'Add repeatable person groups to visit forms (grupos)')
ON CONFLICT (version) DO NOTHING;
