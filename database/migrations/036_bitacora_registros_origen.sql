-- WESApp - Separa la Bitácora visible (Registro) del rastro de auditoría
-- que generan las Visitas (ingreso/salida/anulación).
--
-- bitacora_registros seguía siendo la única tabla de auditoría para ambos
-- flujos, así que cada acción de una Visita terminaba apareciendo también
-- en el tab Registro. origen distingue lo creado manualmente vía
-- "Registrar Bitácora" (visible en Registro) de lo generado automáticamente
-- por Visitas (sigue existiendo como auditoría interna, pero no se lista en
-- Registro).

ALTER TABLE bitacora_registros
  ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'MANUAL'
    CHECK (origen IN ('MANUAL', 'VISITA'));

-- Reclasifica el historial existente: cualquier bitacora_registros ya
-- enlazado como entrada/salida de una Visita es de origen VISITA.
UPDATE bitacora_registros br
SET origen = 'VISITA'
WHERE EXISTS (
  SELECT 1 FROM bitacora_visitas bv
  WHERE bv.entrada_bitacora_registro_id = br.id
     OR bv.salida_bitacora_registro_id = br.id
);

CREATE INDEX IF NOT EXISTS idx_bitacora_registros_origen
  ON bitacora_registros (origen);

INSERT INTO schema_version (version, description)
VALUES (36, 'Add origen to bitacora_registros to separate manual Registro from visit audit trail')
ON CONFLICT (version) DO NOTHING;
