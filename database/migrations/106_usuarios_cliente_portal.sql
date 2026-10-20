-- Acceso de solo lectura para clientes (portal de visitas).
-- Un usuario de tipo 'cliente' pertenece a exactamente un cliente y no tiene
-- colaborador. Cada cliente puede tener como máximo un usuario de portal.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cliente_id INTEGER NULL;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cliente_id_fkey;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_cliente_id_fkey
  FOREIGN KEY (cliente_id)
  REFERENCES clientes(id)
  ON DELETE RESTRICT;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cliente_id_key;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_cliente_id_key UNIQUE (cliente_id);

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_tipo_usuario_check
  CHECK (tipo_usuario IN (
    'gerente',
    'secretario',
    'supervisor',
    'contador',
    'guardia',
    'monitorista',
    'cliente'
  ));

-- El rol 'cliente' exige cliente_id; los demás roles no pueden tenerlo.
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_cliente_rol_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_cliente_rol_check
  CHECK ((tipo_usuario = 'cliente') = (cliente_id IS NOT NULL));

-- Los usuarios de portal no son personal: no requieren colaborador.
CREATE OR REPLACE FUNCTION enforce_usuario_colaborador_required()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo_usuario = 'cliente' THEN
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
VALUES (106, 'Agrega rol cliente y usuarios.cliente_id para el portal de visitas de solo lectura')
ON CONFLICT (version) DO NOTHING;
