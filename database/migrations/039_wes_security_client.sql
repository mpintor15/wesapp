-- WESApp - Elimina el concepto de ubicación "sin cliente"
--
-- Crea (si no existe) el cliente real "WES Security" para representar las
-- operaciones internas de la empresa, y reasigna a él las ubicaciones que
-- hoy quedan agrupadas como "Sin cliente — dato histórico" (cliente_id NULL).
--
-- Es forward-only e idempotente: puede re-ejecutarse (o ya estar aplicada)
-- sin duplicar el cliente ni volver a tocar ubicaciones ya reasignadas.
--
-- Una ubicación histórica solo se reasigna si su nombre no colisiona con el
-- de otra ubicación que ya pertenezca (o vaya a pertenecer) a WES Security,
-- respetando el índice único (cliente_id, LOWER(TRIM(nombre))) de
-- 019_ubicaciones_clientes.sql. Cualquier colisión de nombres se deja tal
-- cual (sigue como histórica) para no perder ni fusionar ubicaciones
-- distintas; se resuelve manualmente después, vía el propio editor de
-- ubicaciones (selector "Cliente"), sin necesidad de otra migración.

BEGIN;

DO $$
DECLARE
  wes_id INTEGER;
BEGIN
  SELECT id INTO wes_id
  FROM clientes
  WHERE LOWER(TRIM(nombre)) = LOWER(TRIM('WES Security'))
  ORDER BY id ASC
  LIMIT 1;

  IF wes_id IS NULL THEN
    INSERT INTO clientes (nombre, estado)
    VALUES ('WES Security', 'activo')
    RETURNING id INTO wes_id;
  END IF;

  UPDATE ubicaciones u
  SET cliente_id = wes_id
  WHERE u.cliente_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM ubicaciones existing
      WHERE existing.id <> u.id
        AND LOWER(TRIM(existing.nombre)) = LOWER(TRIM(u.nombre))
        AND (existing.cliente_id = wes_id OR existing.cliente_id IS NULL)
    );
END
$$;

INSERT INTO schema_version (version, description)
VALUES (39, 'Crea el cliente WES Security y reasigna ubicaciones históricas sin cliente')
ON CONFLICT (version) DO NOTHING;

COMMIT;
