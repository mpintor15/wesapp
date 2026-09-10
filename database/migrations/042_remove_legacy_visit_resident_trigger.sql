-- La dirección de una visita ahora es texto libre; no debe exigir un titular catalogado.
DROP TRIGGER IF EXISTS enforce_bitacora_visita_titular_activo_trigger ON bitacora_visitas;
DROP FUNCTION IF EXISTS enforce_bitacora_visita_titular_activo();

INSERT INTO schema_version (version, description)
VALUES (42, 'Retira validación legacy de titular, Manzana y Villa en visitas manuales')
ON CONFLICT (version) DO NOTHING;
