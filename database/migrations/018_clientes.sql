CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    identificacion TEXT,
    tipo_identificacion TEXT,
    telefono TEXT,
    correo TEXT,
    direccion TEXT,
    ciudad TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS tipo_identificacion TEXT,
    ADD COLUMN IF NOT EXISTS telefono TEXT,
    ADD COLUMN IF NOT EXISTS correo TEXT,
    ADD COLUMN IF NOT EXISTS direccion TEXT,
    ADD COLUMN IF NOT EXISTS ciudad TEXT,
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
DECLARE
    duplicates_count INTEGER;
BEGIN
    SELECT COUNT(*)::int
    INTO duplicates_count
    FROM (
        SELECT LOWER(TRIM(identificacion)) AS identificacion_normalizada
        FROM clientes
        WHERE identificacion IS NOT NULL
          AND TRIM(identificacion) <> ''
        GROUP BY LOWER(TRIM(identificacion))
        HAVING COUNT(*) > 1
    ) duplicated;

    IF duplicates_count > 0 THEN
        RAISE EXCEPTION 'No se puede aplicar 018_clientes: existen identificaciones duplicadas al normalizar LOWER(TRIM(identificacion)). Revise con: SELECT LOWER(TRIM(identificacion)) AS identificacion_normalizada, COUNT(*) FROM clientes WHERE identificacion IS NOT NULL AND TRIM(identificacion) <> '''' GROUP BY LOWER(TRIM(identificacion)) HAVING COUNT(*) > 1;';
    END IF;
END $$;

ALTER TABLE clientes
    ALTER COLUMN nombre SET NOT NULL,
    ALTER COLUMN identificacion DROP NOT NULL,
    ALTER COLUMN estado SET DEFAULT 'activo',
    ALTER COLUMN estado SET NOT NULL;

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'clientes'
          AND c.contype = 'u'
          AND c.conkey = ARRAY[
              (
                  SELECT attnum
                  FROM pg_attribute
                  WHERE attrelid = t.oid
                    AND attname = 'identificacion'
                    AND NOT attisdropped
              )
          ]::smallint[]
    LOOP
        EXECUTE format('ALTER TABLE clientes DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;
END $$;

UPDATE clientes
SET identificacion = NULL
WHERE identificacion IS NOT NULL
  AND TRIM(identificacion) = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_clientes_estado'
          AND conrelid = 'clientes'::regclass
    ) THEN
        ALTER TABLE clientes
            ADD CONSTRAINT chk_clientes_estado CHECK (estado IN ('activo', 'inactivo'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_nombre_normalizado
    ON clientes (LOWER(TRIM(nombre)));

CREATE INDEX IF NOT EXISTS idx_clientes_estado
    ON clientes (estado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_identificacion_normalizada_unique
    ON clientes (LOWER(TRIM(identificacion)))
    WHERE identificacion IS NOT NULL AND TRIM(identificacion) <> '';

INSERT INTO schema_version (version, description)
VALUES (18, 'Clientes catalog normalization')
ON CONFLICT (version) DO NOTHING;
