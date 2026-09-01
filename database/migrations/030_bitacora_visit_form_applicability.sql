-- WESApp - Aplicabilidad y presentación de formularios de visitas

ALTER TABLE bitacora_visit_form_versions
  ADD COLUMN IF NOT EXISTS mostrar_fecha_hora BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE bitacora_visit_form_fields
  ADD COLUMN IF NOT EXISTS aplica_a VARCHAR(10) NOT NULL DEFAULT 'TODOS';

ALTER TABLE bitacora_visit_form_fields
  DROP CONSTRAINT IF EXISTS bitacora_visit_form_fields_aplica_a_check;

ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_aplica_a_check
  CHECK (aplica_a IN ('TODOS', 'PEATON', 'VEHICULO'));

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS tipo_ingreso VARCHAR(10);

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_tipo_ingreso_check;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_placa_por_tipo_check;

UPDATE bitacora_visitas
SET tipo_ingreso = 'PEATON'
WHERE tipo_ingreso = 'PEATONAL';

UPDATE bitacora_visitas
SET tipo_ingreso = CASE
  WHEN placa IS NOT NULL AND BTRIM(placa) <> '' THEN 'VEHICULO'
  ELSE 'PEATON'
END
WHERE tipo_ingreso IS NULL;

ALTER TABLE bitacora_visitas
  ALTER COLUMN tipo_ingreso SET NOT NULL;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_tipo_ingreso_check
  CHECK (tipo_ingreso IN ('PEATON', 'VEHICULO'));

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_placa_por_tipo_check
  CHECK (tipo_ingreso = 'PEATON' OR (placa IS NOT NULL AND BTRIM(placa) <> ''));

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
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
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
     AND NEW.mostrar_fecha_hora = OLD.mostrar_fecha_hora
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_version (version, description)
VALUES (30, 'Add visit form applicability and display configuration')
ON CONFLICT (version) DO NOTHING;
