-- WESApp - Tipos de visita configurables por versión de formulario (D6)
--
-- Reemplaza la dicotomía rígida PEATON/VEHICULO por una lista de tipos de
-- visita definida por cada versión de formulario. Los tipos quedan
-- congelados junto con la versión publicada (misma inmutabilidad que ya
-- aplica a bitacora_visit_form_fields).

CREATE TABLE IF NOT EXISTS bitacora_visit_form_tipos (
  id SERIAL PRIMARY KEY,
  form_version_id INTEGER NOT NULL REFERENCES bitacora_visit_form_versions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(60) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT bitacora_visit_form_tipos_unique_nombre UNIQUE (form_version_id, nombre),
  CONSTRAINT bitacora_visit_form_tipos_id_version_unique UNIQUE (id, form_version_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_tipos_version
  ON bitacora_visit_form_tipos (form_version_id, sort_order, id);

-- Necesario para el FK compuesto de bitacora_visit_form_field_tipos, que
-- garantiza que un campo solo pueda referenciar tipos de su propia versión.
ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_id_version_unique UNIQUE (id, form_version_id);

CREATE TABLE IF NOT EXISTS bitacora_visit_form_field_tipos (
  form_field_id INTEGER NOT NULL,
  form_version_id INTEGER NOT NULL,
  tipo_id INTEGER NOT NULL,
  PRIMARY KEY (form_field_id, tipo_id),
  CONSTRAINT bitacora_visit_form_field_tipos_field_fkey
    FOREIGN KEY (form_field_id, form_version_id)
    REFERENCES bitacora_visit_form_fields (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT bitacora_visit_form_field_tipos_tipo_fkey
    FOREIGN KEY (tipo_id, form_version_id)
    REFERENCES bitacora_visit_form_tipos (id, form_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_field_tipos_tipo
  ON bitacora_visit_form_field_tipos (tipo_id);

-- 1) Backfill: cada versión existente recibe los dos tipos históricos.
INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
SELECT id, 'Peatón', 1 FROM bitacora_visit_form_versions;

INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
SELECT id, 'Vehículo', 2 FROM bitacora_visit_form_versions;

-- 2) aplica_a: reemplaza el valor escalar PEATON/VEHICULO por SELECCIONADOS
--    + fila(s) en la tabla puente; TODOS se conserva igual.
-- bitacora_visit_form_fields is normally immutable once its version is
-- published (enforce_bitacora_visit_form_field_immutability_trigger blocks
-- ALL updates, not just structural ones). This backfill UPDATE is a
-- controlled, single-transaction migration step, not an application write,
-- so the trigger is disabled around it and re-enabled immediately after.
ALTER TABLE bitacora_visit_form_fields
  ADD COLUMN IF NOT EXISTS aplica_a_nuevo VARCHAR(20);

ALTER TABLE bitacora_visit_form_fields
  DISABLE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger;

UPDATE bitacora_visit_form_fields
SET aplica_a_nuevo = CASE WHEN aplica_a = 'TODOS' THEN 'TODOS' ELSE 'SELECCIONADOS' END;

ALTER TABLE bitacora_visit_form_fields
  ENABLE TRIGGER enforce_bitacora_visit_form_field_immutability_trigger;

INSERT INTO bitacora_visit_form_field_tipos (form_field_id, form_version_id, tipo_id)
SELECT f.id, f.form_version_id, t.id
FROM bitacora_visit_form_fields f
JOIN bitacora_visit_form_tipos t
  ON t.form_version_id = f.form_version_id
 AND t.nombre = (CASE f.aplica_a WHEN 'PEATON' THEN 'Peatón' WHEN 'VEHICULO' THEN 'Vehículo' END)
WHERE f.aplica_a IN ('PEATON', 'VEHICULO');

ALTER TABLE bitacora_visit_form_fields
  DROP CONSTRAINT IF EXISTS bitacora_visit_form_fields_aplica_a_check;

ALTER TABLE bitacora_visit_form_fields
  DROP COLUMN aplica_a;

ALTER TABLE bitacora_visit_form_fields
  RENAME COLUMN aplica_a_nuevo TO aplica_a;

ALTER TABLE bitacora_visit_form_fields
  ALTER COLUMN aplica_a SET NOT NULL,
  ALTER COLUMN aplica_a SET DEFAULT 'TODOS';

ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_aplica_a_check
  CHECK (aplica_a IN ('TODOS', 'SELECCIONADOS'));

-- 3) bitacora_visitas: tipo_ingreso (texto libre PEATON/VEHICULO) se
--    reemplaza por tipo_visita_id, referenciando el tipo configurado en la
--    MISMA versión de formulario con la que se registró la visita.
ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS tipo_visita_id INTEGER;

UPDATE bitacora_visitas bv
SET tipo_visita_id = t.id
FROM bitacora_visit_form_tipos t
WHERE t.form_version_id = bv.form_version_id
  AND t.nombre = (CASE bv.tipo_ingreso WHEN 'PEATON' THEN 'Peatón' WHEN 'VEHICULO' THEN 'Vehículo' END);

ALTER TABLE bitacora_visitas
  ALTER COLUMN tipo_visita_id SET NOT NULL;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_tipo_ingreso_check;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_placa_por_tipo_check;

ALTER TABLE bitacora_visitas
  DROP COLUMN tipo_ingreso;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_tipo_visita_fkey
  FOREIGN KEY (tipo_visita_id, form_version_id)
  REFERENCES bitacora_visit_form_tipos (id, form_version_id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bitacora_visitas_tipo_visita
  ON bitacora_visitas (tipo_visita_id);

-- Placa deja de estar condicionada a un tipo hardcodeado: sigue siendo un
-- dato opcional en la visita, y su exigibilidad ahora es responsabilidad
-- exclusiva del campo configurable tipo "placa" (required + aplica_a) que
-- ya valida el backend por cada tipo de visita.

-- 4) Inmutabilidad: los tipos de visita (y su asignación a preguntas)
--    quedan congelados una vez publicada la versión, igual que los campos.
CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_tipo_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se pueden agregar tipos de visita a un formulario publicado'
      USING ERRCODE = '23514';
  END IF;

  RAISE EXCEPTION 'Los tipos de visita de formularios publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_tipo_immutability_trigger ON bitacora_visit_form_tipos;
CREATE TRIGGER enforce_bitacora_visit_form_tipo_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_tipos
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_tipo_immutability();

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_field_tipo_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM bitacora_visit_form_versions
      WHERE id = NEW.form_version_id AND published_at IS NULL
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se pueden asignar tipos de visita a preguntas de un formulario publicado'
      USING ERRCODE = '23514';
  END IF;

  RAISE EXCEPTION 'La asignación de tipos de visita a preguntas publicadas es inmutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bitacora_visit_form_field_tipo_immutability_trigger ON bitacora_visit_form_field_tipos;
CREATE TRIGGER enforce_bitacora_visit_form_field_tipo_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON bitacora_visit_form_field_tipos
  FOR EACH ROW EXECUTE FUNCTION enforce_bitacora_visit_form_field_tipo_immutability();

INSERT INTO schema_version (version, description)
VALUES (32, 'Add per-form-version configurable visit types, replacing PEATON/VEHICULO')
ON CONFLICT (version) DO NOTHING;
