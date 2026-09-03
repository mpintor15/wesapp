export const getInitialFacturasReportFilters = () => ({
  fechaInicio: '',
  fechaFin: '',
  soloDeudores: true,
  agruparCliente: true,
});

export const getInitialPagosReportFilters = () => ({
  fechaInicio: '',
  fechaFin: '',
  metodoPago: '',
});

export const buildFacturasReportParams = (filters) => {
  const params = {};
  if (filters.fechaInicio) params.fecha_inicio = filters.fechaInicio;
  if (filters.fechaFin) params.fecha_fin = filters.fechaFin;
  if (filters.soloDeudores) params.solo_deudores = true;
  if (filters.agruparCliente) params.agrupar_cliente = true;
  return params;
};

export const buildPagosReportParams = (filters) => {
  const params = {};
  if (filters.fechaInicio) params.fecha_inicio = filters.fechaInicio;
  if (filters.fechaFin) params.fecha_fin = filters.fechaFin;
  if (filters.metodoPago) params.metodo_pago = filters.metodoPago;
  return params;
};
