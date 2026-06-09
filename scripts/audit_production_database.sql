\echo '=== WESApp: auditoria de base de datos (solo lectura) ==='
\set ON_ERROR_STOP on
\pset pager off
\pset null '(NULL)'

BEGIN TRANSACTION READ ONLY;

\echo ''
\echo '=== 1. Conexion y version de PostgreSQL ==='
SELECT
  current_database() AS database_name,
  current_user AS database_user,
  current_schema() AS current_schema,
  current_setting('server_version') AS postgres_version;

\echo ''
\echo '=== 2. Versiones de esquema aplicadas ==='
SELECT version, description, applied_at
FROM schema_version
ORDER BY version;

\echo ''
\echo '=== 3. Tablas, vistas y vistas materializadas ==='
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'S' THEN 'sequence'
    ELSE c.relkind::text
  END AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'v', 'm', 'S')
ORDER BY object_type, object_name;

\echo ''
\echo '=== 4. Foreign keys y acciones ON UPDATE / ON DELETE ==='
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''
\echo '=== 5. Restricciones e indices ==='
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '=== 6. Conteo de registros principales ==='
SELECT 'usuarios' AS tabla, COUNT(*) AS registros FROM usuarios
UNION ALL SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL SELECT 'cuentas', COUNT(*) FROM cuentas
UNION ALL SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL SELECT 'abonos', COUNT(*) FROM abonos
UNION ALL SELECT 'ubicaciones', COUNT(*) FROM ubicaciones
UNION ALL SELECT 'articulos', COUNT(*) FROM articulos
UNION ALL SELECT 'movimientos', COUNT(*) FROM movimientos
UNION ALL SELECT 'detalle_movimientos', COUNT(*) FROM detalle_movimientos
UNION ALL SELECT 'articulos_bajas', COUNT(*) FROM articulos_bajas
UNION ALL SELECT 'colaboradores', COUNT(*) FROM colaboradores
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
ORDER BY tabla;

\echo ''
\echo '=== 7. ERRORES: relaciones huerfanas ==='
SELECT 'cuentas_sin_cliente' AS problema, COUNT(*) AS cantidad
FROM cuentas c LEFT JOIN clientes cl ON cl.id = c.cliente_id
WHERE cl.id IS NULL
UNION ALL
SELECT 'abonos_sin_factura', COUNT(*)
FROM abonos a LEFT JOIN cuentas c ON c.num_factura = a.num_factura
WHERE c.num_factura IS NULL
UNION ALL
SELECT 'abonos_sin_pago_con_pago_id', COUNT(*)
FROM abonos a LEFT JOIN pagos p ON p.id = a.pago_id
WHERE a.pago_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'detalle_sin_movimiento', COUNT(*)
FROM detalle_movimientos d LEFT JOIN movimientos m ON m.id = d.movimiento_id
WHERE m.id IS NULL
UNION ALL
SELECT 'detalle_sin_articulo', COUNT(*)
FROM detalle_movimientos d LEFT JOIN articulos a ON a.id = d.articulo_id
WHERE a.id IS NULL
ORDER BY problema;

\echo ''
\echo '=== 8. ERRORES: valores invalidos ==='
SELECT 'facturas_valor_no_positivo' AS problema, COUNT(*) AS cantidad
FROM cuentas WHERE valor_factura <= 0 OR valor_factura IS NULL
UNION ALL
SELECT 'abonos_valor_no_positivo', COUNT(*)
FROM abonos WHERE valor_abono <= 0 OR valor_abono IS NULL
UNION ALL
SELECT 'pagos_total_no_positivo', COUNT(*)
FROM pagos WHERE total <= 0 OR total IS NULL
UNION ALL
SELECT 'articulos_cantidad_negativa', COUNT(*)
FROM articulos WHERE cantidad < 0
UNION ALL
SELECT 'articulos_activos_sin_ubicacion', COUNT(*)
FROM articulos WHERE activo = TRUE AND ubicacion_id IS NULL
UNION ALL
SELECT 'articulos_inactivos_con_stock', COUNT(*)
FROM articulos WHERE activo = FALSE AND COALESCE(cantidad, 0) > 0
UNION ALL
SELECT 'movimientos_origen_igual_destino', COUNT(*)
FROM detalle_movimientos
WHERE ubicacion_origen_id IS NOT DISTINCT FROM ubicacion_destino_id
ORDER BY problema;

\echo ''
\echo '=== 9. ERRORES: pagos cuyo total no coincide con sus abonos ==='
SELECT
  p.id AS pago_id,
  p.total AS total_guardado,
  COALESCE(SUM(a.valor_abono), 0) AS total_abonos,
  p.total - COALESCE(SUM(a.valor_abono), 0) AS diferencia
FROM pagos p
LEFT JOIN abonos a ON a.pago_id = p.id
GROUP BY p.id, p.total
HAVING p.total IS DISTINCT FROM COALESCE(SUM(a.valor_abono), 0)
ORDER BY p.id;

\echo ''
\echo '=== 10. ERRORES: pagos aplicados a facturas de otro cliente ==='
SELECT
  p.id AS pago_id,
  p.cliente_id AS cliente_pago,
  a.num_factura,
  c.cliente_id AS cliente_factura
FROM pagos p
JOIN abonos a ON a.pago_id = p.id
JOIN cuentas c ON c.num_factura = a.num_factura
WHERE p.cliente_id IS DISTINCT FROM c.cliente_id
ORDER BY p.id, a.num_factura;

\echo ''
\echo '=== 11. ERRORES: facturas con abonos superiores al valor por cobrar ==='
SELECT
  v.num_factura,
  v.cliente,
  v.por_cobrar,
  v.total_abonos,
  v.saldo_pendiente
FROM vista_reporte_cuentas v
WHERE v.saldo_pendiente < 0
ORDER BY v.saldo_pendiente;

\echo ''
\echo '=== 12. ADVERTENCIAS: facturas anuladas con abonos ==='
SELECT
  v.num_factura,
  v.cliente,
  v.cancelada,
  v.total_abonos,
  v.saldo_pendiente
FROM vista_reporte_cuentas v
WHERE v.cancelada = TRUE
  AND v.total_abonos > 0
ORDER BY v.num_factura;

\echo ''
\echo '=== 13. ERRORES: duplicados que deberian ser unicos ==='
SELECT 'clientes.nombre' AS campo, nombre AS valor, COUNT(*) AS repeticiones
FROM clientes GROUP BY nombre HAVING COUNT(*) > 1
UNION ALL
SELECT 'clientes.identificacion', identificacion, COUNT(*)
FROM clientes GROUP BY identificacion HAVING COUNT(*) > 1
UNION ALL
SELECT 'usuarios.usuario', usuario, COUNT(*)
FROM usuarios GROUP BY usuario HAVING COUNT(*) > 1
UNION ALL
SELECT 'colaboradores.cedula', cedula, COUNT(*)
FROM colaboradores GROUP BY cedula HAVING COUNT(*) > 1
UNION ALL
SELECT 'articulos.numero_serie', numero_serie, COUNT(*)
FROM articulos WHERE numero_serie IS NOT NULL
GROUP BY numero_serie HAVING COUNT(*) > 1
UNION ALL
SELECT 'articulos.codigo_pantalla', codigo_pantalla, COUNT(*)
FROM articulos WHERE codigo_pantalla IS NOT NULL
GROUP BY codigo_pantalla HAVING COUNT(*) > 1
UNION ALL
SELECT 'articulos.codigo_radio', codigo_radio, COUNT(*)
FROM articulos WHERE codigo_radio IS NOT NULL
GROUP BY codigo_radio HAVING COUNT(*) > 1
ORDER BY campo, valor;

\echo ''
\echo '=== 14. ADVERTENCIAS: datos de negocio sospechosos ==='
SELECT 'retencion_iva_sin_iva' AS problema, COUNT(*) AS cantidad
FROM cuentas
WHERE incluye_retencion_iva = TRUE
  AND COALESCE(incluye_iva, FALSE) = FALSE
UNION ALL
SELECT 'facturas_canceladas_sin_detalle', COUNT(*)
FROM cuentas
WHERE cancelada = TRUE
  AND NULLIF(TRIM(detalle_anulacion), '') IS NULL
UNION ALL
SELECT 'facturas_canceladas_sin_fecha', COUNT(*)
FROM cuentas
WHERE cancelada = TRUE
  AND fecha_anulacion IS NULL
UNION ALL
SELECT 'usuarios_activos_sin_nombre', COUNT(*)
FROM usuarios
WHERE activo = TRUE
  AND (NULLIF(TRIM(nombre), '') IS NULL OR NULLIF(TRIM(apellido), '') IS NULL)
UNION ALL
SELECT 'gerentes_activos', COUNT(*)
FROM usuarios
WHERE activo = TRUE AND tipo_usuario = 'gerente'
ORDER BY problema;

\echo ''
\echo '=== 15. Secuencias atrasadas respecto a IDs existentes ==='
SELECT
  seq.relname AS sequence_name,
  tbl.relname AS table_name,
  attr.attname AS column_name,
  pg_get_serial_sequence(format('%I.%I', ns.nspname, tbl.relname), attr.attname) AS sequence_path
FROM pg_class seq
JOIN pg_depend dep
  ON dep.objid = seq.oid
 AND dep.deptype IN ('a', 'i')
JOIN pg_class tbl ON tbl.oid = dep.refobjid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
JOIN pg_attribute attr
  ON attr.attrelid = tbl.oid
 AND attr.attnum = dep.refobjsubid
WHERE seq.relkind = 'S'
  AND ns.nspname = 'public'
ORDER BY table_name, column_name;

\echo ''
\echo '=== Auditoria terminada: no se modificaron datos ==='
ROLLBACK;
