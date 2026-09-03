const ALERTA_ESTADOS = new Set(['vencida', 'proxima_a_vencer', 'vigente']);

const ARTICULOS_SORT_COLUMNS = Object.freeze({
  tipo_articulo: 'tipo_articulo',
  nombre_articulo: 'nombre_articulo',
  serie: 'CONCAT(COALESCE(codigo_radio, numero_serie))',
  cantidad: 'cantidad',
  talla: 'talla',
  marca: 'marca',
  modelo: 'modelo',
  calibre: 'calibre',
  codigo_pantalla: 'codigo_pantalla',
  version: 'version',
  fecha_caducidad: 'fecha_caducidad',
  ubicacion_nombre: 'ubicacion_nombre',
  estado: 'estado',
  created_at: 'created_at',
});

const MOVIMIENTOS_SORT_COLUMNS = Object.freeze({
  fecha_movimiento: 'fecha_movimiento',
  items: 'items',
  articulos_movidos: 'articulos_movidos',
  ubicacion_origen: 'ubicacion_origen',
  ubicacion_destino: 'ubicacion_destino',
  usuario: 'usuario',
});

module.exports = {
  ALERTA_ESTADOS,
  ARTICULOS_SORT_COLUMNS,
  MOVIMIENTOS_SORT_COLUMNS,
};
