-- Cuando un colaborador pasa a estado 'inactivo', el usuario del sistema
-- vinculado (si existe) pierde el acceso automáticamente.

CREATE OR REPLACE FUNCTION revoke_usuario_access_on_colaborador_inactivo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'inactivo' AND OLD.estado IS DISTINCT FROM 'inactivo' THEN
    UPDATE usuarios
    SET activo = FALSE
    WHERE colaborador_id = NEW.id AND activo = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Guarded: some migration test fixtures model `colaboradores` as a bare
-- table without `estado` to exercise unrelated migrations in isolation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'estado'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_revoke_usuario_access_on_colaborador_inactivo ON colaboradores';
    EXECUTE '
      CREATE TRIGGER trg_revoke_usuario_access_on_colaborador_inactivo
        AFTER UPDATE OF estado ON colaboradores
        FOR EACH ROW
        EXECUTE FUNCTION revoke_usuario_access_on_colaborador_inactivo()';
  END IF;
END $$;

INSERT INTO schema_version (version, description)
VALUES (40, 'Revoke system user access automatically when their colaborador becomes inactive')
ON CONFLICT (version) DO NOTHING;
