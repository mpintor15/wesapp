const roundCurrency = (value) => Math.round(value * 100) / 100;

const calculateBatchPaymentTotal = (abonos) =>
  roundCurrency(abonos.reduce((sum, abono) => sum + abono.valor_abono, 0));

const normalizePaymentAmount = (value) => roundCurrency(value);

module.exports = {
  calculateBatchPaymentTotal,
  normalizePaymentAmount,
  roundCurrency,
};
