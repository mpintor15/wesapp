const PAYMENT_METHODS = Object.freeze(['efectivo', 'transferencia', 'cheque', 'otro']);

const FACTURAS_SORT_COLUMNS = Object.freeze({
  num_factura: 'num_factura',
  fecha_factura: 'fecha_factura',
  cliente: 'cliente',
  identificacion: 'identificacion',
});

const PAGOS_SORT_COLUMNS = Object.freeze({
  fecha: 'fecha',
  total: 'total',
  cliente: 'cliente',
  metodo_pago: 'metodo_pago',
  created_at: 'created_at',
});

const CUENTAS_LIMITS = Object.freeze({
  PAYMENT_REFERENCE_MAX_LENGTH: 100,
  PAYMENT_NOTES_MAX_LENGTH: 500,
});

module.exports = {
  CUENTAS_LIMITS,
  FACTURAS_SORT_COLUMNS,
  PAGOS_SORT_COLUMNS,
  PAYMENT_METHODS,
};
