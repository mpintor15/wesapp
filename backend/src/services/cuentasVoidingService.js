const { createHttpError } = require('../utils/http');

const INVOICE_ALREADY_VOIDED = 'INVOICE_ALREADY_VOIDED';
const PAYMENT_CANNOT_BE_VOIDED = 'PAYMENT_CANNOT_BE_VOIDED';
const INVOICE_CANNOT_BE_VOIDED = 'INVOICE_CANNOT_BE_VOIDED';

const INVOICE_ALREADY_VOIDED_MESSAGE = 'La factura ya está anulada.';
const PAYMENT_CANNOT_BE_VOIDED_MESSAGE =
  'El modelo actual no permite anular pagos de forma segura sin perder trazabilidad. El pago y sus abonos se conservaron.';
const INVOICE_DELETE_DEPRECATED_MESSAGE =
  'La eliminación física de facturas está deshabilitada. Usa la anulación para conservar el historial contable.';

const createConflict = (code, message) => {
  const error = createHttpError(409, message);
  error.appCode = code;
  return error;
};

const voidInvoice = async ({ executor, numFactura, detalleAnulacion }) => {
  const current = await executor.query(
    `SELECT num_factura, cancelada, cliente_id, fecha_factura, valor_factura,
            incluye_iva, incluye_retencion_fuente, incluye_retencion_iva,
            detalle_anulacion, fecha_anulacion
     FROM cuentas
     WHERE num_factura = $1
     FOR UPDATE`,
    [numFactura]
  );

  if (current.rowCount === 0) {
    throw createHttpError(404, 'Factura no encontrada');
  }

  if (current.rows[0].cancelada) {
    throw createConflict(INVOICE_ALREADY_VOIDED, INVOICE_ALREADY_VOIDED_MESSAGE);
  }

  const result = await executor.query(
    `UPDATE cuentas
     SET cancelada = TRUE,
         detalle_anulacion = $2,
         fecha_anulacion = CURRENT_TIMESTAMP
     WHERE num_factura = $1
     RETURNING num_factura, cancelada, detalle_anulacion, fecha_anulacion`,
    [numFactura, detalleAnulacion]
  );

  return {
    previous: current.rows[0],
    invoice: result.rows[0],
  };
};

const rejectPhysicalInvoiceDeletion = async ({ executor, numFactura }) => {
  const current = await executor.query('SELECT num_factura FROM cuentas WHERE num_factura = $1', [
    numFactura,
  ]);

  if (current.rowCount === 0) {
    throw createHttpError(404, 'Factura no encontrada');
  }

  throw createConflict(INVOICE_CANNOT_BE_VOIDED, INVOICE_DELETE_DEPRECATED_MESSAGE);
};

const rejectPaymentVoidingWithoutModel = async ({ executor, pagoId }) => {
  const current = await executor.query('SELECT id FROM pagos WHERE id = $1', [pagoId]);

  if (current.rowCount === 0) {
    throw createHttpError(404, 'Pago no encontrado');
  }

  throw createConflict(PAYMENT_CANNOT_BE_VOIDED, PAYMENT_CANNOT_BE_VOIDED_MESSAGE);
};

module.exports = {
  INVOICE_ALREADY_VOIDED,
  INVOICE_CANNOT_BE_VOIDED,
  PAYMENT_CANNOT_BE_VOIDED,
  INVOICE_ALREADY_VOIDED_MESSAGE,
  INVOICE_DELETE_DEPRECATED_MESSAGE,
  PAYMENT_CANNOT_BE_VOIDED_MESSAGE,
  rejectPaymentVoidingWithoutModel,
  rejectPhysicalInvoiceDeletion,
  voidInvoice,
};
