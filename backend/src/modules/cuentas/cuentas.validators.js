const { CUENTAS_LIMITS, PAYMENT_METHODS } = require('./cuentas.constants');
const { calculateBatchPaymentTotal, normalizePaymentAmount } = require('./cuentas.calculations');
const {
  parseStrictPositiveInteger,
  parseStrictPositiveNumber,
  validateRequiredDateString,
} = require('../../utils/inputValidation');

const validationError = (message, status = 400) => ({
  valid: false,
  status,
  message,
});

const validationSuccess = (value) => ({
  valid: true,
  value,
});

const parsePositiveIntegerId = (value, message) => {
  const result = parseStrictPositiveInteger(value, message);
  return result.valid ? validationSuccess(result.value) : validationError(message);
};

const validateClientePayload = (payload) => {
  const { nombre, identificacion } = payload;

  if (!nombre || !nombre.trim()) {
    return validationError('El nombre del cliente es requerido');
  }

  if (!identificacion || !identificacion.trim()) {
    return validationError('La identificación del cliente es requerida');
  }

  return validationSuccess({
    nombre: nombre.trim(),
    identificacion: identificacion.trim(),
  });
};

const validateFacturaCreatePayload = (payload) => {
  const {
    num_factura,
    cliente_id,
    fecha_factura,
    valor_factura,
    incluye_iva,
    incluye_retencion_fuente,
    incluye_retencion_iva,
  } = payload;

  if (!num_factura || !cliente_id || !fecha_factura || !valor_factura) {
    return validationError(
      'Todos los campos son requeridos: num_factura, cliente_id, fecha_factura, valor_factura'
    );
  }

  const numFacturaValidation = parsePositiveIntegerId(
    num_factura,
    'El número de factura debe ser un entero mayor a 0'
  );
  const clienteValidation = parsePositiveIntegerId(
    cliente_id,
    'El cliente especificado no es válido'
  );
  const valorValidation = parseStrictPositiveNumber(
    valor_factura,
    'El valor de la factura debe ser mayor a 0'
  );
  const fechaValidation = validateRequiredDateString(
    fecha_factura,
    'La fecha de factura no es válida'
  );

  if (!numFacturaValidation.valid) {
    return validationError(numFacturaValidation.message);
  }

  if (!clienteValidation.valid) {
    return validationError(clienteValidation.message);
  }

  if (!valorValidation.valid) {
    return validationError(valorValidation.message);
  }

  if (!fechaValidation.valid) {
    return validationError(fechaValidation.message);
  }

  if (incluye_retencion_iva && !incluye_iva) {
    return validationError('La retención de IVA requiere que IVA esté habilitado');
  }

  return validationSuccess({
    parsedNumFactura: numFacturaValidation.value,
    parsedClienteId: clienteValidation.value,
    parsedValorFactura: valorValidation.value,
    fecha_factura,
    incluye_iva: !!incluye_iva,
    incluye_retencion_fuente: !!incluye_retencion_fuente,
    incluye_retencion_iva: !!incluye_retencion_iva,
  });
};

const validateFacturaUpdatePayload = (payload) => {
  const { cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente } =
    payload;
  const incluye_retencion_iva = payload.incluye_retencion_iva;

  if (!cliente_id || !fecha_factura || !valor_factura) {
    return validationError('Campos requeridos: cliente_id, fecha_factura, valor_factura');
  }

  const clienteValidation = parsePositiveIntegerId(
    cliente_id,
    'El cliente especificado no es válido'
  );
  const valorValidation = parseStrictPositiveNumber(
    valor_factura,
    'El valor de la factura debe ser mayor a 0'
  );
  const fechaValidation = validateRequiredDateString(
    fecha_factura,
    'La fecha de factura no es válida'
  );

  if (!clienteValidation.valid) {
    return validationError(clienteValidation.message);
  }

  if (!valorValidation.valid) {
    return validationError(valorValidation.message);
  }

  if (!fechaValidation.valid) {
    return validationError(fechaValidation.message);
  }

  const ivaFinal = !!incluye_iva;

  return validationSuccess({
    parsedClienteId: clienteValidation.value,
    parsedValorFactura: valorValidation.value,
    fecha_factura,
    incluye_iva: ivaFinal,
    incluye_retencion_fuente: !!incluye_retencion_fuente,
    incluye_retencion_iva: ivaFinal ? !!incluye_retencion_iva : false,
  });
};

const validateFacturaCancellationDetail = (detalleAnulacion) => {
  if (!detalleAnulacion || !detalleAnulacion.trim()) {
    return validationError('El detalle de anulación es obligatorio');
  }

  return validationSuccess(detalleAnulacion.trim());
};

const validateBatchPaymentPayload = (payload) => {
  const { cliente_id, fecha, metodo_pago, referencia, notas, abonos } = payload;
  const clienteValidation = parsePositiveIntegerId(
    cliente_id,
    'Se requiere un cliente válido para registrar el pago'
  );
  const fechaValidation = validateRequiredDateString(
    fecha,
    'La fecha del pago es obligatoria y debe ser válida'
  );
  const metodoPagoNormalizado = metodo_pago ? String(metodo_pago).trim().toLowerCase() : null;
  const referenciaNormalizada = typeof referencia === 'string' ? referencia.trim() : null;
  const notasNormalizadas = typeof notas === 'string' ? notas.trim() : null;

  if (!clienteValidation.valid) {
    return validationError(clienteValidation.message);
  }

  if (!fechaValidation.valid) {
    return validationError(fechaValidation.message);
  }

  if (metodoPagoNormalizado && !PAYMENT_METHODS.includes(metodoPagoNormalizado)) {
    return validationError('El método de pago no es válido');
  }

  if (
    referenciaNormalizada &&
    referenciaNormalizada.length > CUENTAS_LIMITS.PAYMENT_REFERENCE_MAX_LENGTH
  ) {
    return validationError('La referencia no puede superar los 100 caracteres');
  }

  if (notasNormalizadas && notasNormalizadas.length > CUENTAS_LIMITS.PAYMENT_NOTES_MAX_LENGTH) {
    return validationError('Las notas no pueden superar los 500 caracteres');
  }

  if (!Array.isArray(abonos) || abonos.length === 0) {
    return validationError('Debes seleccionar al menos una factura con monto');
  }

  const seenFacturas = new Set();
  const abonosNormalizados = [];

  for (const item of abonos) {
    const numFacturaValidation = parsePositiveIntegerId(
      item?.num_factura,
      'Cada abono debe tener num_factura y valor_abono mayor a 0'
    );
    const valorAbonoValidation = parseStrictPositiveNumber(
      item?.valor_abono,
      'Cada abono debe tener num_factura y valor_abono mayor a 0'
    );

    if (!numFacturaValidation.valid || !valorAbonoValidation.valid) {
      return validationError('Cada abono debe tener num_factura y valor_abono mayor a 0');
    }

    if (seenFacturas.has(numFacturaValidation.value)) {
      return validationError(
        `La factura #${numFacturaValidation.value} está repetida en la distribución`
      );
    }

    seenFacturas.add(numFacturaValidation.value);
    abonosNormalizados.push({
      num_factura: numFacturaValidation.value,
      valor_abono: normalizePaymentAmount(valorAbonoValidation.value),
    });
  }

  return validationSuccess({
    parsedClienteId: clienteValidation.value,
    fecha,
    metodoPagoNormalizado,
    referenciaNormalizada,
    notasNormalizadas,
    abonosNormalizados,
    total: calculateBatchPaymentTotal(abonosNormalizados),
  });
};

module.exports = {
  parsePositiveIntegerId,
  validateBatchPaymentPayload,
  validateClientePayload,
  validateFacturaCancellationDetail,
  validateFacturaCreatePayload,
  validateFacturaUpdatePayload,
};
