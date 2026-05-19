-- ============================================
-- WESApp - Pagos Migration
-- Migration 003: Add pagos table as payment header
-- ============================================

-- Create pagos table (payment header)
CREATE TABLE IF NOT EXISTS pagos (
    id           SERIAL PRIMARY KEY,
    cliente_id   INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    fecha        DATE NOT NULL,
    metodo_pago  VARCHAR(50),
    referencia   VARCHAR(100),
    notas        TEXT,
    total        NUMERIC(10,2) NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);

-- Link abonos to pagos
ALTER TABLE abonos ADD COLUMN IF NOT EXISTS pago_id INTEGER REFERENCES pagos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_abonos_pago ON abonos(pago_id);

-- Version tracking
INSERT INTO schema_version (version, description)
VALUES (3, 'Add pagos table as payment header; link abonos via pago_id')
ON CONFLICT (version) DO NOTHING;
