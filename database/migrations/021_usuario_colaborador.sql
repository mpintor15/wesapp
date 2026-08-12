-- WESApp - Relación opcional Usuario ↔ Colaborador

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS colaborador_id INTEGER NULL;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_colaborador_id_fkey;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_colaborador_id_fkey
  FOREIGN KEY (colaborador_id)
  REFERENCES colaboradores(id)
  ON DELETE RESTRICT;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_colaborador_id_key;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_colaborador_id_key UNIQUE (colaborador_id);

INSERT INTO schema_version (version, description)
VALUES (21, 'Add optional one-to-one Usuario-Colaborador relationship')
ON CONFLICT (version) DO NOTHING;
