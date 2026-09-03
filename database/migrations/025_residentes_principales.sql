-- WESApp - Residente principal por Villa

CREATE TABLE IF NOT EXISTS residentes (
  id SERIAL PRIMARY KEY,
  villa_id INTEGER NOT NULL REFERENCES villas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(150) NOT NULL,
  contacto VARCHAR(150) NOT NULL,
  es_principal BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_residentes_villa_principal_activo_unique
  ON residentes (villa_id)
  WHERE es_principal = TRUE AND activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_residentes_villa ON residentes (villa_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_residente_active_chain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.activo = TRUE AND NOT EXISTS (
    SELECT 1 FROM villas v
    JOIN manzanas m ON m.id = v.manzana_id
    JOIN ubicaciones u ON u.id = m.ubicacion_id
    WHERE v.id = NEW.villa_id AND v.estado = 'activo'
      AND m.estado = 'activo' AND u.tipo_punto = 'URBANIZACION'
  ) THEN
    RAISE EXCEPTION 'El Residente activo requiere Villa, Manzana y Urbanización activas'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_villa_deactivation_with_resident()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'activo' AND NEW.estado = 'inactivo'
     AND EXISTS (SELECT 1 FROM residentes WHERE villa_id = OLD.id AND es_principal = TRUE AND activo = TRUE) THEN
    RAISE EXCEPTION 'No se puede desactivar una Villa con Residente principal activo'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_residente_active_chain_trigger ON residentes;
CREATE TRIGGER enforce_residente_active_chain_trigger
  BEFORE INSERT OR UPDATE OF villa_id, activo ON residentes
  FOR EACH ROW EXECUTE FUNCTION enforce_residente_active_chain();

DROP TRIGGER IF EXISTS prevent_villa_deactivation_with_resident_trigger ON villas;
CREATE TRIGGER prevent_villa_deactivation_with_resident_trigger
  BEFORE UPDATE OF estado ON villas
  FOR EACH ROW EXECUTE FUNCTION prevent_villa_deactivation_with_resident();

DROP TRIGGER IF EXISTS update_residentes_updated_at ON residentes;
CREATE TRIGGER update_residentes_updated_at BEFORE UPDATE ON residentes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_version (version, description)
VALUES (25, 'Add primary residents for villas')
ON CONFLICT (version) DO NOTHING;
