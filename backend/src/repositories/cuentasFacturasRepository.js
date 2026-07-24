const db = require('../config/database');

const findNextFacturaNumber = (executor = db) =>
  executor.query('SELECT COALESCE(MAX(num_factura), 0) + 1 AS next_num FROM cuentas');

const findFacturaForUpdate = (numFactura, executor = db) =>
  executor.query(
    'SELECT num_factura, cancelada, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva FROM cuentas WHERE num_factura = $1',
    [numFactura]
  );

const lockFacturasByNumeros = (facturaIds, executor = db) =>
  executor.query(
    `SELECT num_factura
     FROM cuentas
     WHERE num_factura = ANY($1::int[])
     FOR UPDATE`,
    [facturaIds]
  );

const findFacturasForPaymentValidation = (facturaIds, executor = db) =>
  executor.query(
    `SELECT
       c.num_factura,
       c.cliente_id,
       c.cancelada,
       COALESCE(v.saldo_pendiente, 0) AS saldo_pendiente
     FROM cuentas c
     LEFT JOIN vista_reporte_cuentas v ON v.num_factura = c.num_factura
     WHERE c.num_factura = ANY($1::int[])`,
    [facturaIds]
  );

const createFactura = (
  {
    numFactura,
    clienteId,
    fechaFactura,
    valorFactura,
    incluyeIva,
    incluyeRetencionFuente,
    incluyeRetencionIva,
  },
  executor = db
) =>
  executor.query(
    `INSERT INTO cuentas (num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva`,
    [
      numFactura,
      clienteId,
      fechaFactura,
      valorFactura,
      incluyeIva,
      incluyeRetencionFuente,
      incluyeRetencionIva,
    ]
  );

const cancelFacturaByNumero = (numFactura, detalleAnulacion, executor = db) =>
  executor.query(
    `UPDATE cuentas
     SET cancelada = TRUE,
         detalle_anulacion = $2,
         fecha_anulacion = CURRENT_TIMESTAMP
    WHERE num_factura = $1
     RETURNING num_factura, cancelada, detalle_anulacion, fecha_anulacion`,
    [numFactura, detalleAnulacion]
  );

const updateFacturaByNumero = (
  {
    numFactura,
    clienteId,
    fechaFactura,
    valorFactura,
    incluyeIva,
    incluyeRetencionFuente,
    incluyeRetencionIva,
  },
  executor = db
) =>
  executor.query(
    `UPDATE cuentas
     SET cliente_id = $2, fecha_factura = $3, valor_factura = $4,
         incluye_iva = $5, incluye_retencion_fuente = $6, incluye_retencion_iva = $7
     WHERE num_factura = $1
     RETURNING num_factura, cliente_id, fecha_factura, valor_factura, incluye_iva, incluye_retencion_fuente, incluye_retencion_iva`,
    [
      numFactura,
      clienteId,
      fechaFactura,
      valorFactura,
      incluyeIva,
      incluyeRetencionFuente,
      incluyeRetencionIva,
    ]
  );

module.exports = {
  cancelFacturaByNumero,
  createFactura,
  findFacturaForUpdate,
  findFacturasForPaymentValidation,
  findNextFacturaNumber,
  lockFacturasByNumeros,
  updateFacturaByNumero,
};
