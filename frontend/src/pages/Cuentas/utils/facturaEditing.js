export const buildEditFacturaFormData = (factura) => ({
  cliente_id: String(factura.cliente_id || ''),
  fecha_factura: factura.fecha_factura ? String(factura.fecha_factura).split('T')[0] : '',
  valor_factura: String(parseFloat(factura.subtotal || 0)),
  incluye_iva: !!factura.incluye_iva,
  incluye_retencion_fuente: !!factura.incluye_retencion_fuente,
  incluye_retencion_iva: !!factura.incluye_retencion_iva,
});

export const applyEditFacturaFieldChange = (formData, target) => {
  const { name, value, type, checked } = target;
  return {
    ...formData,
    [name]: type === 'checkbox' ? checked : value,
    ...(name === 'incluye_iva' && !checked ? { incluye_retencion_iva: false } : {}),
  };
};

export const validateEditFacturaForm = (formData) => {
  const parsedValor = parseFloat(formData.valor_factura);

  if (!formData.cliente_id || !formData.fecha_factura || !formData.valor_factura) {
    return 'Todos los campos son requeridos';
  }

  if (!Number.isFinite(parsedValor) || parsedValor <= 0) {
    return 'El subtotal debe ser mayor a 0';
  }

  return '';
};

export const buildUpdateFacturaPayload = (formData) => ({
  cliente_id: parseInt(formData.cliente_id),
  fecha_factura: formData.fecha_factura,
  valor_factura: parseFloat(formData.valor_factura),
  incluye_iva: formData.incluye_iva,
  incluye_retencion_fuente: formData.incluye_retencion_fuente,
  incluye_retencion_iva: formData.incluye_retencion_iva,
});
