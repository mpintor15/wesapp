ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_colaborador_required;

CREATE OR REPLACE FUNCTION enforce_usuario_colaborador_required()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.colaborador_id IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'El colaborador es requerido'
        USING ERRCODE = '23514', CONSTRAINT = 'usuarios_colaborador_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_colaborador_required ON usuarios;

CREATE TRIGGER trg_usuarios_colaborador_required
  BEFORE INSERT OR UPDATE OF colaborador_id ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION enforce_usuario_colaborador_required();

INSERT INTO schema_version (version, description)
VALUES (26, 'Require collaborator for new and updated users')
ON CONFLICT (version) DO NOTHING;
