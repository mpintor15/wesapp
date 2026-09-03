-- WESApp - Visita "No autorizada" como estado propio, distinto de ANULADA
--
-- ANULADA representa una visita ya aceptada que un admin cancela después.
-- NO_AUTORIZADA representa el rechazo del guardia al momento del ingreso:
-- es un evento distinto, con su propio motivo, por lo que no reutiliza
-- estado ni motivo_anulacion.

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_estado_check;

-- 'NO_AUTORIZADA' tiene 13 caracteres; el VARCHAR(12) original solo
-- alcanzaba para ABIERTA/CERRADA/ANULADA.
ALTER TABLE bitacora_visitas
  ALTER COLUMN estado TYPE VARCHAR(20);

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_estado_check
  CHECK (estado IN ('ABIERTA', 'CERRADA', 'ANULADA', 'NO_AUTORIZADA'));

ALTER TABLE bitacora_visitas
  ADD COLUMN IF NOT EXISTS motivo_no_autorizacion TEXT NULL;

ALTER TABLE bitacora_visitas
  DROP CONSTRAINT IF EXISTS bitacora_visitas_no_autorizacion_coherente_check;

ALTER TABLE bitacora_visitas
  ADD CONSTRAINT bitacora_visitas_no_autorizacion_coherente_check
  CHECK (
    (estado = 'NO_AUTORIZADA' AND motivo_no_autorizacion IS NOT NULL AND BTRIM(motivo_no_autorizacion) <> '')
    OR (estado <> 'NO_AUTORIZADA' AND motivo_no_autorizacion IS NULL)
  );

INSERT INTO schema_version (version, description)
VALUES (37, 'Add NO_AUTORIZADA visita state with its own motivo, distinct from anulacion')
ON CONFLICT (version) DO NOTHING;
