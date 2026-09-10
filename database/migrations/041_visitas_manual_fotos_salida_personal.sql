-- Visitas con dirección manual, preguntas con foto y datos de salida de Personal.

ALTER TABLE bitacora_visit_form_fields
  DROP CONSTRAINT IF EXISTS bitacora_visit_form_fields_type_check;
ALTER TABLE bitacora_visit_form_fields
  ADD CONSTRAINT bitacora_visit_form_fields_type_check
  CHECK (type IN ('text', 'textarea', 'number', 'select', 'checkbox', 'cedula', 'placa', 'photo'));

ALTER TABLE bitacora_visita_respuestas
  DROP CONSTRAINT IF EXISTS bitacora_visita_respuestas_type_snapshot_check;

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS manzana_texto VARCHAR(100),
  ADD COLUMN IF NOT EXISTS villa_texto VARCHAR(100),
  ALTER COLUMN manzana_id DROP NOT NULL,
  ALTER COLUMN villa_id DROP NOT NULL,
  ALTER COLUMN residente_principal_id DROP NOT NULL;

UPDATE bitacora_visitas bv
SET manzana_texto = COALESCE(bv.manzana_texto, m.nombre),
    villa_texto = COALESCE(bv.villa_texto, v.identificador)
FROM manzanas m, villas v
WHERE bv.manzana_id = m.id AND bv.villa_id = v.id;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_manzana_texto_check
    CHECK (manzana_texto IS NULL OR BTRIM(manzana_texto) <> ''),
  ADD CONSTRAINT bitacora_visitas_villa_texto_check
    CHECK (villa_texto IS NULL OR BTRIM(villa_texto) <> '');

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS fecha_salida DATE,
  ADD COLUMN IF NOT EXISTS salida_voluntaria BOOLEAN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'estado'
  ) THEN
    UPDATE colaboradores
    SET fecha_salida = COALESCE(fecha_salida, CURRENT_DATE),
        salida_voluntaria = COALESCE(salida_voluntaria, FALSE)
    WHERE estado = 'inactivo';

    ALTER TABLE colaboradores
      DROP CONSTRAINT IF EXISTS colaboradores_salida_inactivo_check;
    ALTER TABLE colaboradores
      ADD CONSTRAINT colaboradores_salida_inactivo_check CHECK (
        (estado = 'activo' AND fecha_salida IS NULL AND salida_voluntaria IS NULL)
        OR
        (estado = 'inactivo' AND fecha_salida IS NOT NULL AND salida_voluntaria IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

INSERT INTO schema_version (version, description)
VALUES (41, 'Visitas manuales, fotos en formularios y datos de salida de colaboradores')
ON CONFLICT (version) DO NOTHING;
