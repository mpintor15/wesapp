-- WESApp - Eliminación lógica de versiones archivadas de formularios de visita

ALTER TABLE bitacora_visit_form_versions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bitacora_visit_form_versions_visible
  ON bitacora_visit_form_versions (ubicacion_id, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_bitacora_visit_form_version_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los formularios de visita publicados no se pueden eliminar'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado = 'ACTIVE' AND NEW.estado = 'ARCHIVED'
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
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
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
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

  IF OLD.estado = 'ARCHIVED' AND NEW.estado = 'ARCHIVED'
     AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
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

  RAISE EXCEPTION 'Los formularios de visita publicados son inmutables'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_version (version, description)
VALUES (38, 'Eliminación lógica de formularios de visita archivados')
ON CONFLICT (version) DO NOTHING;
