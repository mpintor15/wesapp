const PAYMENT_METHODS = Object.freeze(['efectivo', 'transferencia', 'cheque', 'otro']);

const CUENTAS_LIMITS = Object.freeze({
  PAYMENT_REFERENCE_MAX_LENGTH: 100,
  PAYMENT_NOTES_MAX_LENGTH: 500,
});

module.exports = {
  CUENTAS_LIMITS,
  PAYMENT_METHODS,
};
