export const getInitialFacturaForm = () => ({
  num_factura: '',
  cliente_id: '',
  fecha_factura: '',
  valor_factura: '',
  incluye_iva: false,
  incluye_retencion_fuente: false,
  incluye_retencion_iva: false,
});

export const DEFAULT_FACTURA_FILTERS = {
  search: '',
  fechaInicio: '',
  fechaFin: '',
  conSaldo: true,
  ordenAlfabetico: true,
  estado: '',
};

export const DEFAULT_PAGO_FILTERS = {
  search: '',
  fechaInicio: '',
  fechaFin: '',
  metodoPago: '',
  agruparCliente: true,
};

export const ROWS_PER_PAGE = 50;
export const PAGOS_ROWS_PER_PAGE = 50;
