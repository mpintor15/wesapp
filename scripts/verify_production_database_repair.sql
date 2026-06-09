\echo '=== Verificacion posterior a migracion 013 ==='
\set ON_ERROR_STOP on
\pset pager off

SELECT version, description, applied_at
FROM schema_version
WHERE version IN (4, 5, 11, 12, 13)
ORDER BY version;

SELECT to_regclass('public.retenciones') AS retenciones_table;

SELECT
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('clientes', 'cuentas')
  AND column_name = 'updated_at'
ORDER BY table_name;

SELECT
  event_object_table AS table_name,
  trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('update_clientes_updated_at', 'update_cuentas_updated_at')
ORDER BY table_name;

SELECT
  conrelid::regclass AS table_name,
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname IN ('chk_valor_factura_positive', 'chk_valor_abono_positive')
ORDER BY conrelid::regclass::text;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_cuentas_cancelada',
    'idx_cuentas_fecha_cancelada',
    'idx_audit_tabla',
    'idx_audit_fecha',
    'idx_audit_usuario'
  )
ORDER BY indexname;

SELECT
  (SELECT COUNT(*) FROM cuentas) AS cuentas,
  (SELECT COUNT(*) FROM abonos) AS abonos,
  (SELECT COUNT(*) FROM pagos) AS pagos,
  (SELECT COUNT(*) FROM clientes) AS clientes;
