-- ============================================
-- WESApp - Performance & Audit Migration
-- Migration 002: Add indexes, audit logging, and constraints
-- ============================================

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_abonos_factura ON abonos(num_factura);
CREATE INDEX IF NOT EXISTS idx_cuentas_cancelada ON cuentas(cancelada) WHERE cancelada = FALSE;
CREATE INDEX IF NOT EXISTS idx_cuentas_fecha_cancelada ON cuentas(fecha_factura, cancelada);

-- Add audit logging table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  operacion VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  registro_id VARCHAR(100),
  usuario_id INTEGER,
  usuario_nombre VARCHAR(100),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tabla ON audit_log(tabla);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log(usuario_id);

-- Add updated_at column to key tables for tracking changes
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_cuentas_updated_at ON cuentas;
CREATE TRIGGER update_cuentas_updated_at
  BEFORE UPDATE ON cuentas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add check constraints for data integrity
ALTER TABLE cuentas
  ADD CONSTRAINT chk_valor_factura_positive
  CHECK (valor_factura > 0);

ALTER TABLE abonos
  ADD CONSTRAINT chk_valor_abono_positive
  CHECK (valor_abono > 0);

-- Add version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_version (version, description)
VALUES (2, 'Performance indexes, audit logging, and data integrity constraints')
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE audit_log IS 'Registro de auditoría para todas las operaciones críticas';
COMMENT ON INDEX idx_abonos_factura IS 'Mejora performance de JOIN en vista_reporte_cuentas';
COMMENT ON INDEX idx_cuentas_cancelada IS 'Mejora filtrado de facturas activas';
