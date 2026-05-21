-- Migration 012: Índice en abonos.pago_id
-- Sin este índice, la query de getPagos hace un full scan de la tabla abonos
-- cada vez que hace el JOIN ON a.pago_id = p.id.

CREATE INDEX IF NOT EXISTS idx_abonos_pago_id ON abonos(pago_id);

INSERT INTO schema_version (version, description)
VALUES (12, 'Index on abonos(pago_id) for getPagos join performance')
ON CONFLICT (version) DO NOTHING;
