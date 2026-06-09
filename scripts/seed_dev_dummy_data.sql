-- Seed de datos basura para ambiente de desarrollo (PostgreSQL)
-- Uso:
--   psql -h localhost -p 5432 -U <user> -d <db> -f scripts/seed_dev_dummy_data.sql

BEGIN;

-- ============================================
-- Catálogos base
-- ============================================
INSERT INTO ubicaciones (nombre)
VALUES
  ('Bodega QA'),
  ('Oficina QA'),
  ('Puesto Norte QA'),
  ('Puesto Sur QA'),
  ('Vehículo QA 01'),
  ('Vehículo QA 02')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- Clientes de prueba
-- ============================================
WITH base AS (
  SELECT COALESCE(MAX(id), 0) AS max_id FROM clientes
)
INSERT INTO clientes (nombre, identificacion)
SELECT
  'Cliente QA ' || (base.max_id + g)::text,
  '099' || LPAD((base.max_id + g)::text, 10, '0')
FROM base
CROSS JOIN generate_series(1, 25) AS g
ON CONFLICT (identificacion) DO NOTHING;

-- ============================================
-- Facturas de prueba
-- ============================================
WITH max_fact AS (
  SELECT COALESCE(MAX(num_factura), 9000) AS max_num FROM cuentas
),
pool AS (
  SELECT
    id AS cliente_id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn,
    COUNT(*) OVER () AS total
  FROM clientes
),
nuevas AS (
  SELECT
    (max_fact.max_num + g) AS num_factura,
    cp.cliente_id AS cliente_id,
    (CURRENT_DATE - ((random() * 240)::int))::date AS fecha_factura,
    ROUND((150 + random() * 6850)::numeric, 2) AS valor_factura,
    (random() < 0.78) AS incluye_iva,
    (random() < 0.46) AS incluye_retencion_fuente,
    (random() < 0.33) AS incluye_retencion_iva
  FROM max_fact
  CROSS JOIN generate_series(1, 90) AS g
  CROSS JOIN LATERAL (
    SELECT cliente_id
    FROM pool
    WHERE rn = (((g + FLOOR(random() * 1000)::int) - 1) % (SELECT MAX(total) FROM pool)) + 1
    LIMIT 1
  ) AS cp
)
INSERT INTO cuentas (
  num_factura,
  cliente_id,
  fecha_factura,
  valor_factura,
  incluye_iva,
  incluye_retencion_fuente,
  incluye_retencion_iva,
  cancelada
)
SELECT
  num_factura,
  cliente_id,
  fecha_factura,
  valor_factura,
  incluye_iva,
  incluye_retencion_fuente,
  incluye_retencion_iva,
  FALSE
FROM nuevas;

-- Marcar algunas facturas como anuladas para probar el dropdown de anulación
DO $$
DECLARE
  has_detalle BOOLEAN;
  has_fecha_anulacion BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cuentas' AND column_name = 'detalle_anulacion'
  ) INTO has_detalle;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cuentas' AND column_name = 'fecha_anulacion'
  ) INTO has_fecha_anulacion;

  IF has_detalle AND has_fecha_anulacion THEN
    EXECUTE $sql$
      UPDATE cuentas
      SET
        cancelada = TRUE,
        detalle_anulacion = 'Anulación de prueba QA por ajuste administrativo',
        fecha_anulacion = NOW() - ((random() * 18)::int || ' days')::interval
      WHERE num_factura IN (
        SELECT num_factura
        FROM cuentas
        WHERE cancelada = FALSE
        ORDER BY random()
        LIMIT 12
      )
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE cuentas
      SET cancelada = TRUE
      WHERE num_factura IN (
        SELECT num_factura
        FROM cuentas
        WHERE cancelada = FALSE
        ORDER BY random()
        LIMIT 12
      )
    $sql$;
  END IF;
END $$;

-- ============================================
-- Pagos batch + abonos de prueba
-- ============================================
DO $$
DECLARE
  rec RECORD;
  pago_id INTEGER;
  fecha_pago DATE;
  metodo TEXT;
  run_tag TEXT := TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSMS');
  metodos TEXT[] := ARRAY['efectivo', 'transferencia', 'cheque', 'otro'];
  has_pago_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'abonos' AND column_name = 'pago_id'
  ) INTO has_pago_id;

  CREATE TEMP TABLE tmp_open_facturas AS
  SELECT
    c.cliente_id,
    c.num_factura,
    v.saldo_pendiente,
    ROW_NUMBER() OVER (PARTITION BY c.cliente_id ORDER BY random()) AS rn
  FROM cuentas c
  JOIN vista_reporte_cuentas v ON v.num_factura = c.num_factura
  WHERE c.cancelada = FALSE
    AND v.saldo_pendiente > 30;

  -- Máximo 8 facturas por cliente para crear más grupos batch de prueba.
  DELETE FROM tmp_open_facturas WHERE rn > 8;

  ALTER TABLE tmp_open_facturas ADD COLUMN grp INTEGER;
  UPDATE tmp_open_facturas SET grp = ((rn - 1) / 2) + 1;

  FOR rec IN
    SELECT DISTINCT cliente_id, grp
    FROM tmp_open_facturas
    ORDER BY cliente_id, grp
  LOOP
    fecha_pago := (CURRENT_DATE - ((random() * 75)::int))::date;
    metodo := metodos[1 + FLOOR(random() * 4)::int];

    IF has_pago_id THEN
      INSERT INTO pagos (cliente_id, fecha, metodo_pago, referencia, notas, total)
      VALUES (
        rec.cliente_id,
        fecha_pago,
        metodo,
        'QA-' || run_tag || '-' || rec.cliente_id || '-' || rec.grp,
        'Pago de prueba para validar flujo batch y dropdown',
        0
      )
      RETURNING id INTO pago_id;

      INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono)
      SELECT
        pago_id,
        t.num_factura,
        fecha_pago,
        GREATEST(
          1,
          ROUND(
            LEAST(
              t.saldo_pendiente,
              t.saldo_pendiente * (0.35 + random() * 0.50)
            )::numeric,
            2
          )
        )
      FROM tmp_open_facturas t
      WHERE t.cliente_id = rec.cliente_id
        AND t.grp = rec.grp;

      UPDATE pagos p
      SET total = COALESCE((
        SELECT SUM(a.valor_abono)::numeric(10,2)
        FROM abonos a
        WHERE a.pago_id = p.id
      ), 0)
      WHERE p.id = pago_id;
    ELSE
      INSERT INTO abonos (num_factura, fecha_abono, valor_abono)
      SELECT
        t.num_factura,
        fecha_pago,
        GREATEST(
          1,
          ROUND(
            LEAST(
              t.saldo_pendiente,
              t.saldo_pendiente * (0.35 + random() * 0.50)
            )::numeric,
            2
          )
        )
      FROM tmp_open_facturas t
      WHERE t.cliente_id = rec.cliente_id
        AND t.grp = rec.grp;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- Inventario de prueba
-- ============================================
WITH pool AS (
  SELECT id AS ubicacion_id FROM ubicaciones
),
base AS (
  SELECT TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSMS') AS run_tag
)
INSERT INTO articulos (
  tipo_articulo,
  nombre_articulo,
  cantidad,
  talla,
  marca,
  modelo,
  numero_serie,
  calibre,
  fecha_caducidad,
  codigo_pantalla,
  codigo_radio,
  version,
  ubicacion_id
)
SELECT
  CASE
    WHEN g % 4 = 0 THEN 'equipo'
    WHEN g % 4 = 1 THEN 'placa_balistica'
    WHEN g % 4 = 2 THEN 'arma'
    ELSE 'radio'
  END AS tipo_articulo,
  CASE
    WHEN g % 4 = 0 THEN 'Artículo QA Equipo ' || g
    WHEN g % 4 = 1 THEN 'Placa QA ' || g
    WHEN g % 4 = 2 THEN 'Arma QA ' || g
    ELSE 'Radio QA ' || g
  END AS nombre_articulo,
  CASE WHEN g % 4 = 0 THEN (1 + (random() * 24)::int) ELSE 1 END AS cantidad,
  CASE WHEN g % 4 = 0 THEN (ARRAY['S', 'M', 'L', 'XL'])[1 + (random() * 3)::int] ELSE NULL END AS talla,
  CASE WHEN g % 4 IN (2, 3) THEN (ARRAY['Motorola', 'Glock', 'Kenwood', 'Icom'])[1 + (random() * 3)::int] ELSE NULL END AS marca,
  CASE WHEN g % 4 IN (2, 3) THEN 'Modelo QA ' || g ELSE NULL END AS modelo,
  CASE
    WHEN g % 4 = 0 THEN NULL
    ELSE 'QA-SERIE-' || base.run_tag || '-' || LPAD(g::text, 4, '0')
  END AS numero_serie,
  CASE WHEN g % 4 = 2 THEN (ARRAY['9mm', '12GA', '5.56'])[1 + (random() * 2)::int] ELSE NULL END AS calibre,
  CASE
    WHEN g % 4 = 1 THEN
      CASE
        WHEN g % 9 = 0 THEN (CURRENT_DATE - (5 + (random() * 15)::int))::date
        WHEN g % 5 = 0 THEN (CURRENT_DATE + (5 + (random() * 20)::int))::date
        ELSE (CURRENT_DATE + (80 + (random() * 1000)::int))::date
      END
    ELSE NULL
  END AS fecha_caducidad,
  CASE WHEN g % 4 = 3 THEN 'PANT-' || LPAD(g::text, 5, '0') ELSE NULL END AS codigo_pantalla,
  CASE WHEN g % 4 = 3 THEN 'RAD-' || LPAD(g::text, 5, '0') ELSE NULL END AS codigo_radio,
  CASE WHEN g % 4 = 3 THEN 'v' || (1 + (random() * 4)::int)::text || '.' || ((random() * 9)::int)::text ELSE NULL END AS version,
  (SELECT ubicacion_id FROM pool ORDER BY random() LIMIT 1) AS ubicacion_id
FROM generate_series(1, 70) AS g
CROSS JOIN base;

-- ============================================
-- Colaboradores de prueba
-- ============================================
WITH base AS (
  SELECT COALESCE(MAX(id), 0) AS max_id FROM colaboradores
)
INSERT INTO colaboradores (
  nombres_completos,
  cedula,
  fecha_nacimiento,
  cargo,
  celular,
  banco,
  numero_cuenta,
  sueldo,
  estado
)
SELECT
  'Colaborador QA ' || (base.max_id + g),
  '19' || LPAD((base.max_id + g)::text, 8, '0'),
  (DATE '1978-01-01' + ((random() * 9500)::int || ' days')::interval)::date,
  (ARRAY['Guardia', 'Supervisor', 'Operador', 'Recepcionista', 'Coordinador'])[1 + FLOOR(random() * 5)::int],
  '09' || LPAD((10000000 + (random() * 89999999)::int)::text, 8, '0'),
  (ARRAY['Banco Pichincha', 'Banco Guayaquil', 'Banco del Pacífico'])[1 + FLOOR(random() * 3)::int],
  LPAD((1000000000 + (random() * 899999999)::int)::text, 10, '0'),
  ROUND((460 + random() * 900)::numeric, 2),
  CASE WHEN random() < 0.88 THEN 'activo' ELSE 'inactivo' END
FROM base
CROSS JOIN generate_series(1, 30) AS g
ON CONFLICT (cedula) DO NOTHING;

-- ============================================
-- Movimientos y detalle de movimientos de prueba
-- ============================================
DO $$
DECLARE
  i INTEGER;
  j INTEGER;
  mov_id INTEGER;
  usr_id INTEGER;
  art_id INTEGER;
  org_id INTEGER;
  dst_id INTEGER;
BEGIN
  FOR i IN 1..14 LOOP
    SELECT id INTO usr_id FROM usuarios ORDER BY random() LIMIT 1;

    INSERT INTO movimientos (usuario_id, fecha_movimiento, pdf_path)
    VALUES (
      usr_id,
      NOW() - ((random() * 30)::int || ' days')::interval,
      NULL
    )
    RETURNING id INTO mov_id;

    FOR j IN 1..(1 + FLOOR(random() * 3)::int) LOOP
      SELECT id INTO art_id FROM articulos ORDER BY random() LIMIT 1;

      SELECT id INTO org_id FROM ubicaciones ORDER BY random() LIMIT 1;
      SELECT id INTO dst_id FROM ubicaciones WHERE id <> org_id ORDER BY random() LIMIT 1;

      INSERT INTO detalle_movimientos (
        movimiento_id,
        articulo_id,
        cantidad,
        ubicacion_origen_id,
        ubicacion_destino_id
      )
      VALUES (
        mov_id,
        art_id,
        1 + FLOOR(random() * 3)::int,
        org_id,
        dst_id
      );
    END LOOP;
  END LOOP;
END $$;

COMMIT;
