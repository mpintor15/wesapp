export const isClienteActivoForOperation = (cliente) => cliente.estado !== 'inactivo';

export const filterClientesBySearch = (clientes, search) => {
  const normalizedSearch = search.toLowerCase();
  return clientes.filter((cliente) => {
    if (!isClienteActivoForOperation(cliente)) return false;
    return (
      cliente.nombre.toLowerCase().includes(normalizedSearch) ||
      String(cliente.identificacion || '')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });
};

export const getExistingInvoiceNumbers = (reporte) =>
  new Set(
    (reporte || [])
      .map((row) => Number(row.num_factura))
      .filter((num) => Number.isInteger(num) && num > 0)
  );

export const getNumFacturaError = (numFacturaInput, existingInvoiceNumbers, fallbackError) => {
  const numFactura = Number(numFacturaInput);
  const isDuplicate = Number.isInteger(numFactura) && existingInvoiceNumbers.has(numFactura);
  return isDuplicate ? 'Este N° de factura ya está registrado. Usa uno diferente.' : fallbackError;
};

export const validateFacturaForm = (formData, existingInvoiceNumbers) => {
  const errors = {};
  const numFactura = Number(formData.num_factura);
  const valorFactura = Number(formData.valor_factura);
  const fechaFacturaDate = formData.fecha_factura
    ? new Date(`${formData.fecha_factura}T00:00:00`)
    : null;

  if (!formData.num_factura) {
    errors.num_factura = 'Ingresa el número de factura';
  } else if (!Number.isInteger(numFactura) || numFactura <= 0) {
    errors.num_factura = 'El N° de factura debe ser un entero mayor a 0';
  } else if (existingInvoiceNumbers.has(numFactura)) {
    errors.num_factura = 'Este N° de factura ya está registrado. Usa uno diferente.';
  }

  if (!formData.cliente_id) {
    errors.cliente_id = 'Selecciona un cliente de la lista';
  }

  if (!formData.fecha_factura) {
    errors.fecha_factura = 'Selecciona la fecha de factura';
  } else if (Number.isNaN(fechaFacturaDate?.getTime())) {
    errors.fecha_factura = 'La fecha ingresada no es válida';
  }

  if (!formData.valor_factura) {
    errors.valor_factura = 'Ingresa el subtotal de la factura';
  } else if (!Number.isFinite(valorFactura) || valorFactura <= 0) {
    errors.valor_factura = 'El subtotal debe ser mayor a 0';
  }

  if (formData.incluye_retencion_iva && !formData.incluye_iva) {
    errors.incluye_retencion_iva = 'La retención de IVA requiere que IVA esté activo';
  }

  return errors;
};

export const calculateFacturaPreview = (formData) => {
  const subtotal = Number(formData.valor_factura) || 0;
  const iva = formData.incluye_iva ? subtotal * 0.15 : 0;
  const retencionFuente = formData.incluye_retencion_fuente ? subtotal * 0.03 : 0;
  const retencionIva = formData.incluye_iva && formData.incluye_retencion_iva ? iva * 0.7 : 0;
  const porCobrar = subtotal + iva - retencionFuente - retencionIva;
  return { subtotal, iva, retencionFuente, retencionIva, porCobrar };
};

export const buildFacturaPayload = (formData) => ({
  num_factura: parseInt(formData.num_factura),
  cliente_id: parseInt(formData.cliente_id),
  fecha_factura: formData.fecha_factura,
  valor_factura: parseFloat(formData.valor_factura),
  incluye_iva: formData.incluye_iva,
  incluye_retencion_fuente: formData.incluye_retencion_fuente,
  incluye_retencion_iva: formData.incluye_retencion_iva,
});

export const shouldShowFacturaCalculation = (debouncedInputs, formData) =>
  parseInt(debouncedInputs.num_factura, 10) >= 1 &&
  !!formData.cliente_id &&
  /^\d{4}-\d{2}-\d{2}$/.test(formData.fecha_factura) &&
  parseFloat(debouncedInputs.valor_factura) >= 0.01;
