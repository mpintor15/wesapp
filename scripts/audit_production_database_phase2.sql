\echo '=== WESApp: auditoria estructural fase 2 (solo lectura) ==='
\set ON_ERROR_STOP on
\pset pager off
\pset null '(NULL)'

BEGIN TRANSACTION READ ONLY;

\echo ''
\echo '=== 1. Columnas de tablas principales ==='
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'usuarios', 'clientes', 'cuentas', 'retenciones', 'pagos', 'abonos',
    'ubicaciones', 'articulos', 'movimientos', 'detalle_movimientos',
    'articulos_bajas', 'colaboradores', 'audit_log', 'schema_version'
  )
ORDER BY table_name, ordinal_position;

\echo ''
\echo '=== 2. Restricciones CHECK, UNIQUE y PRIMARY KEY ==='
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  CASE contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    ELSE contype::text
  END AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, constraint_type, conname;

\echo ''
\echo '=== 3. Triggers activos ==='
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;

\echo ''
\echo '=== 4. Definicion actual de vistas ==='
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('vista_reporte_cuentas', 'vista_inventario_alertas')
ORDER BY viewname;

\echo ''
\echo '=== 5. Tabla retenciones obsoleta: uso real ==='
SELECT (to_regclass('public.retenciones') IS NOT NULL)::int AS retenciones_exists \gset
\if :retenciones_exists
  SELECT
    COUNT(*) AS total_retenciones,
    COALESCE(SUM(valor_retencion), 0) AS valor_total,
    MIN(fecha_retencion) AS primera_fecha,
    MAX(fecha_retencion) AS ultima_fecha
  FROM retenciones;

  SELECT
    r.num_retencion,
    r.num_factura,
    r.fecha_retencion,
    r.valor_retencion
  FROM retenciones r
  ORDER BY r.fecha_retencion DESC, r.num_retencion DESC
  LIMIT 20;
\else
  \echo 'retenciones no existe (estado esperado)'
\endif

\echo ''
\echo '=== 6. Abonos heredados sin cabecera de pago ==='
SELECT
  COUNT(*) AS abonos_sin_pago,
  COALESCE(SUM(valor_abono), 0) AS valor_total
FROM abonos
WHERE pago_id IS NULL;

\echo ''
\echo '=== 7. Auditoria: cobertura y ultimos registros ==='
SELECT
  tabla,
  operacion,
  COUNT(*) AS registros
FROM audit_log
GROUP BY tabla, operacion
ORDER BY tabla, operacion;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
ORDER BY ordinal_position;

SELECT *
FROM audit_log
ORDER BY id DESC
LIMIT 20;

\echo ''
\echo '=== 8. Secuencias y maxima clave actual ==='
SELECT
  'usuarios' AS tabla,
  MAX(id) AS max_id,
  (SELECT last_value FROM usuarios_id_seq) AS sequence_last_value
FROM usuarios
UNION ALL
SELECT 'clientes', MAX(id), (SELECT last_value FROM clientes_id_seq) FROM clientes
UNION ALL
SELECT 'pagos', MAX(id), (SELECT last_value FROM pagos_id_seq) FROM pagos
UNION ALL
SELECT 'abonos', MAX(id), (SELECT last_value FROM abonos_id_seq) FROM abonos
UNION ALL
SELECT 'ubicaciones', MAX(id), (SELECT last_value FROM ubicaciones_id_seq) FROM ubicaciones
UNION ALL
SELECT 'articulos', MAX(id), (SELECT last_value FROM articulos_id_seq) FROM articulos
UNION ALL
SELECT 'movimientos', MAX(id), (SELECT last_value FROM movimientos_id_seq) FROM movimientos
UNION ALL
SELECT 'detalle_movimientos', MAX(id), (SELECT last_value FROM detalle_movimientos_id_seq) FROM detalle_movimientos
UNION ALL
SELECT 'articulos_bajas', MAX(id), (SELECT last_value FROM articulos_bajas_id_seq) FROM articulos_bajas
UNION ALL
SELECT 'colaboradores', MAX(id), (SELECT last_value FROM colaboradores_id_seq) FROM colaboradores
UNION ALL
SELECT 'audit_log', MAX(id), (SELECT last_value FROM audit_log_id_seq) FROM audit_log
ORDER BY tabla;

\echo ''
\echo '=== 9. Indices redundantes exactos ==='
WITH normalized AS (
  SELECT
    schemaname,
    tablename,
    indexname,
    regexp_replace(indexdef, 'CREATE (UNIQUE )?INDEX [^ ]+ ON ', 'CREATE \1INDEX ON ') AS normalized_definition
  FROM pg_indexes
  WHERE schemaname = 'public'
)
SELECT
  tablename,
  STRING_AGG(indexname, ', ' ORDER BY indexname) AS equivalent_indexes,
  normalized_definition
FROM normalized
GROUP BY tablename, normalized_definition
HAVING COUNT(*) > 1
ORDER BY tablename;

\echo ''
\echo '=== 10. Indices esperados ausentes ==='
WITH expected(index_name) AS (
  VALUES
    ('idx_cuentas_cancelada'),
    ('idx_cuentas_fecha_cancelada'),
    ('idx_audit_tabla'),
    ('idx_audit_fecha'),
    ('idx_audit_usuario'),
    ('idx_abonos_pago'),
    ('idx_abonos_factura'),
    ('idx_pagos_cliente'),
    ('idx_pagos_fecha'),
    ('idx_articulos_bajas_fecha'),
    ('idx_articulos_bajas_articulo'),
    ('idx_articulos_bajas_usuario')
)
SELECT e.index_name
FROM expected e
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = e.index_name
WHERE i.indexname IS NULL
ORDER BY e.index_name;

\echo ''
\echo '=== 11. Versiones de esquema faltantes entre 2 y 12 ==='
SELECT expected.version AS missing_version
FROM generate_series(2, 12) AS expected(version)
LEFT JOIN schema_version sv ON sv.version = expected.version
WHERE sv.version IS NULL
ORDER BY expected.version;

\echo ''
\echo '=== Auditoria fase 2 terminada: no se modificaron datos ==='
ROLLBACK;
