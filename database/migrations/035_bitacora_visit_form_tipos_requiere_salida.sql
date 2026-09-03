-- WESApp - Tipos de visita: requiere_salida configurable por versión de formulario
--
-- Antes, toda visita quedaba ABIERTA hasta un cierre manual. Ahora cada tipo
-- de visita configurado en el builder declara si exige registrar salida.
-- Si no la exige, la visita se cierra automáticamente al momento del
-- ingreso (mismo principio de inmutabilidad ya aplicado a nombre/sort_order
-- de bitacora_visit_form_tipos: queda congelado junto con la versión
-- publicada vía el trigger existente).

ALTER TABLE bitacora_visit_form_tipos
  ADD COLUMN IF NOT EXISTS requiere_salida BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_version (version, description)
VALUES (35, 'Add requiere_salida to bitacora_visit_form_tipos (per-tipo auto-close)')
ON CONFLICT (version) DO NOTHING;
