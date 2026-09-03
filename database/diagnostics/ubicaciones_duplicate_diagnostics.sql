-- Diagnóstico read-only previo a migration 017.
-- Si devuelve filas, corrija manualmente los nombres duplicados antes de desplegar.

SELECT
  LOWER(TRIM(nombre)) AS nombre_normalizado,
  COUNT(*)::int AS total,
  ARRAY_AGG(id ORDER BY id) AS ubicacion_ids,
  ARRAY_AGG(nombre ORDER BY id) AS nombres_actuales
FROM ubicaciones
GROUP BY LOWER(TRIM(nombre))
HAVING COUNT(*) > 1
ORDER BY nombre_normalizado;
