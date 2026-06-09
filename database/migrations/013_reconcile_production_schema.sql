-- ============================================
-- WESApp - Reconciliacion del esquema de produccion
-- Migration 013
-- ============================================
--
-- Corrige diferencias confirmadas mediante auditoria en Neon:
-- - Elimina retenciones, tabla obsoleta y vacia.
-- - Agrega updated_at y sus triggers a clientes y cuentas.
-- - Agrega restricciones positivas a facturas y abonos.
-- - Crea indices faltantes para cuentas y audit_log.
-- - Registra migraciones cuyo efecto ya existe en produccion.

BEGIN;

-- Bloquear escrituras en las tablas afectadas mientras se valida y ajusta el esquema.
LOCK TABLE cuentas, abonos, clientes, audit_log IN SHARE ROW EXCLUSIVE MODE;

-- Abortamos sin modificar nada si aparecieron datos incompatibles desde la auditoria.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cuentas WHERE valor_factura <= 0 OR valor_factura IS NULL) THEN
    RAISE EXCEPTION 'No se puede agregar chk_valor_factura_positive: existen facturas con valor no positivo';
  END IF;

  IF EXISTS (SELECT 1 FROM abonos WHERE valor_abono <= 0 OR valor_abono IS NULL) THEN
    RAISE EXCEPTION 'No se puede agregar chk_valor_abono_positive: existen abonos con valor no positivo';
  END IF;

  IF to_regclass('public.retenciones') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM retenciones) THEN
      RAISE EXCEPTION 'No se puede eliminar retenciones: la tabla ya no esta vacia';
    END IF;
  END IF;
END $$;

-- La aplicacion calcula retenciones desde los booleanos de cuentas.
DROP TABLE IF EXISTS retenciones CASCADE;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE clientes
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

UPDATE cuentas
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cuentas_updated_at ON cuentas;
CREATE TRIGGER update_cuentas_updated_at
  BEFORE UPDATE ON cuentas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cuentas'::regclass
      AND conname = 'chk_valor_factura_positive'
  ) THEN
    ALTER TABLE cuentas
      ADD CONSTRAINT chk_valor_factura_positive CHECK (valor_factura > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.abonos'::regclass
      AND conname = 'chk_valor_abono_positive'
  ) THEN
    ALTER TABLE abonos
      ADD CONSTRAINT chk_valor_abono_positive CHECK (valor_abono > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cuentas_cancelada
  ON cuentas(cancelada)
  WHERE cancelada = FALSE;

CREATE INDEX IF NOT EXISTS idx_cuentas_fecha_cancelada
  ON cuentas(fecha_factura, cancelada);

CREATE INDEX IF NOT EXISTS idx_audit_tabla
  ON audit_log(tabla);

-- Produccion usa audit_log.created_at, no fecha_hora.
CREATE INDEX IF NOT EXISTS idx_audit_fecha
  ON audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_usuario
  ON audit_log(usuario_id);

INSERT INTO schema_version (version, description)
VALUES
  (4, 'Reconciled: cancellation columns already present'),
  (5, 'Reconciled: remove obsolete retenciones table'),
  (11, 'Reconciled: articulos_bajas already present'),
  (12, 'Reconciled: abonos pago index already present'),
  (13, 'Reconcile production schema, constraints, triggers and indexes')
ON CONFLICT (version) DO NOTHING;

COMMIT;
