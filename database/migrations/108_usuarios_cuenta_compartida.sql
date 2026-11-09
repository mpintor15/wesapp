-- Cuentas de módulo: usuarios que no pertenecen a una persona (p. ej. "Módulo 1 Monitoreo").
-- No tienen colaborador. Solo se permiten con rol 'monitorista' y nunca junto a un colaborador.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS es_cuenta_compartida BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cuenta_compartida_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_cuenta_compartida_check
  CHECK (
    NOT es_cuenta_compartida
    OR (tipo_usuario = 'monitorista' AND colaborador_id IS NULL AND cliente_id IS NULL)
  );

CREATE OR REPLACE FUNCTION enforce_usuario_colaborador_required()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo_usuario = 'cliente' OR NEW.es_cuenta_compartida THEN
    RETURN NEW;
  END IF;

  IF NEW.colaborador_id IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'El colaborador es requerido'
        USING ERRCODE = '23514', CONSTRAINT = 'usuarios_colaborador_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_version (version, description)
VALUES (108, 'Agrega usuarios.es_cuenta_compartida para cuentas de módulo sin colaborador')
ON CONFLICT (version) DO NOTHING;
