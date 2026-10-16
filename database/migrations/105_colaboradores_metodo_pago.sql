-- Método de pago del colaborador: transferencia bancaria (banco + cuenta) o cheque.
-- Los colaboradores existentes quedan como transferencia, que era el único método.
ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) NOT NULL DEFAULT 'transferencia';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_metodo_pago_check'
  ) THEN
    ALTER TABLE colaboradores
      ADD CONSTRAINT colaboradores_metodo_pago_check
      CHECK (metodo_pago IN ('transferencia', 'cheque'));
  END IF;
END $$;

INSERT INTO schema_version (version, description)
VALUES (105, 'Agrega metodo_pago (transferencia o cheque) a colaboradores')
ON CONFLICT (version) DO NOTHING;
