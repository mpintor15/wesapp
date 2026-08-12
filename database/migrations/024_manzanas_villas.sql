-- WESApp - Maestros de Manzanas y Villas para Urbanizaciones

CREATE TABLE IF NOT EXISTS manzanas (
  id SERIAL PRIMARY KEY,
  ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre VARCHAR(100) NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manzanas_ubicacion_nombre_normalizado_unique
  ON manzanas (ubicacion_id, LOWER(REGEXP_REPLACE(TRIM(nombre), '\s+', ' ', 'g')));

CREATE INDEX IF NOT EXISTS idx_manzanas_ubicacion ON manzanas (ubicacion_id);

CREATE TABLE IF NOT EXISTS villas (
  id SERIAL PRIMARY KEY,
  manzana_id INTEGER NOT NULL REFERENCES manzanas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  identificador VARCHAR(100) NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_villas_manzana_identificador_normalizado_unique
  ON villas (manzana_id, LOWER(REGEXP_REPLACE(TRIM(identificador), '\s+', ' ', 'g')));

CREATE INDEX IF NOT EXISTS idx_villas_manzana ON villas (manzana_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_manzana_urbanizacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ubicaciones
    WHERE id = NEW.ubicacion_id AND tipo_punto = 'URBANIZACION'
  ) THEN
    RAISE EXCEPTION 'Las Manzanas solo pertenecen a ubicaciones URBANIZACION'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_urbanizacion_downgrade_with_manzanas()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tipo_punto = 'URBANIZACION'
     AND NEW.tipo_punto <> 'URBANIZACION'
     AND EXISTS (SELECT 1 FROM manzanas WHERE ubicacion_id = OLD.id) THEN
    RAISE EXCEPTION 'No se puede cambiar a GENERAL una Urbanización con Manzanas'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_manzana_urbanizacion_trigger ON manzanas;
CREATE TRIGGER enforce_manzana_urbanizacion_trigger
  BEFORE INSERT OR UPDATE OF ubicacion_id ON manzanas
  FOR EACH ROW EXECUTE FUNCTION enforce_manzana_urbanizacion();

DROP TRIGGER IF EXISTS prevent_urbanizacion_downgrade_trigger ON ubicaciones;
CREATE TRIGGER prevent_urbanizacion_downgrade_trigger
  BEFORE UPDATE OF tipo_punto ON ubicaciones
  FOR EACH ROW EXECUTE FUNCTION prevent_urbanizacion_downgrade_with_manzanas();

DROP TRIGGER IF EXISTS update_manzanas_updated_at ON manzanas;
CREATE TRIGGER update_manzanas_updated_at BEFORE UPDATE ON manzanas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_villas_updated_at ON villas;
CREATE TRIGGER update_villas_updated_at BEFORE UPDATE ON villas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO schema_version (version, description)
VALUES (24, 'Add blocks and villas for urbanization locations')
ON CONFLICT (version) DO NOTHING;
