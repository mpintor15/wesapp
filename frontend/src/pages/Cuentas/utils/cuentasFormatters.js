export const formatMoney = (value) => {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '$0.00';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const dateOnlyMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-EC');
  }
  return new Date(dateStr).toLocaleDateString('es-EC');
};

export const formatMetodoPago = (value) => {
  if (!value) return '-';
  const map = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    cheque: 'Cheque',
    otro: 'Otro',
  };
  return map[String(value).toLowerCase()] || value;
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};
