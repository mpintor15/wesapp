import { formatMoney } from './cuentasFormatters';

export const autoDistribute = (total, invoices) => {
  let remaining = Math.round(parseFloat(total) * 100) / 100;
  const newSelections = {};
  for (const invoice of invoices) {
    if (remaining <= 0) {
      newSelections[invoice.num_factura] = { selected: false, amount: '' };
      continue;
    }
    const saldo = parseFloat(invoice.saldo_pendiente);
    const amount = Math.min(remaining, saldo);
    newSelections[invoice.num_factura] = { selected: true, amount: amount.toFixed(2) };
    remaining = Math.round((remaining - amount) * 100) / 100;
  }
  return newSelections;
};

export const getPendingInvoicesForCustomer = (reporte, customer) => {
  if (!customer) return [];

  return reporte
    .filter(
      (row) =>
        Number(row.cliente_id) === customer.id &&
        !row.cancelada &&
        parseFloat(row.saldo_pendiente) > 0
    )
    .sort((a, b) => {
      const dateDiff = new Date(a.fecha_factura) - new Date(b.fecha_factura);
      if (dateDiff !== 0) return dateDiff;
      return Number(a.num_factura) - Number(b.num_factura);
    });
};

export const calculateBatchPaymentSummary = (invoices, selections, totalCredit) => {
  const totalPendiente = invoices.reduce(
    (sum, invoice) => sum + parseFloat(invoice.saldo_pendiente),
    0
  );
  const totalAllocated = invoices.reduce((sum, invoice) => {
    const selection = selections[invoice.num_factura];
    return sum + (selection?.selected && selection?.amount ? parseFloat(selection.amount) || 0 : 0);
  }, 0);
  const remaining = Math.round((parseFloat(totalCredit || 0) - totalAllocated) * 100) / 100;

  return { totalPendiente, totalAllocated, remaining };
};

export const validateBatchPaymentForm = ({
  customer,
  date,
  totalCredit,
  notas,
  invoices,
  selections,
  totalPendiente,
  remaining,
}) => {
  const errors = {};
  const parsedTotalCredit = parseFloat(totalCredit);
  const fechaPago = date ? new Date(`${date}T00:00:00`) : null;

  if (!customer) {
    errors.cliente = 'Debes seleccionar un cliente antes de continuar';
  }

  if (!date || Number.isNaN(fechaPago?.getTime())) {
    errors.fecha = 'Indica la fecha en que se realizó el pago';
  }

  if (!totalCredit || Number.isNaN(parsedTotalCredit) || parsedTotalCredit <= 0) {
    errors.total = 'Ingresa el monto total que el cliente pagó';
  } else if (parsedTotalCredit > totalPendiente) {
    errors.total = `El monto ingresado supera lo que este cliente debe. El máximo es ${formatMoney(totalPendiente)}`;
  }

  if (notas && notas.trim().length > 500) {
    errors.notas = 'Las notas no pueden superar los 500 caracteres';
  }

  const selectedAbonos = invoices
    .filter(
      (invoice) =>
        selections[invoice.num_factura]?.selected && selections[invoice.num_factura]?.amount
    )
    .map((invoice) => ({
      num_factura: invoice.num_factura,
      valor_abono: parseFloat(selections[invoice.num_factura].amount),
      saldo_pendiente: parseFloat(invoice.saldo_pendiente),
    }));

  if (selectedAbonos.length === 0) {
    errors.abonos = 'Selecciona al menos una factura a la que aplicar el pago';
  }

  for (const abono of selectedAbonos) {
    if (!Number.isFinite(abono.valor_abono) || abono.valor_abono <= 0) {
      errors[`amount_${abono.num_factura}`] = 'El monto de esta factura no es válido';
    } else if (abono.valor_abono > abono.saldo_pendiente) {
      errors[`amount_${abono.num_factura}`] =
        `El monto supera el saldo de esta factura (${formatMoney(abono.saldo_pendiente)})`;
    }
  }

  if (remaining > 0.01) {
    errors.abonos = `Todavía quedan ${formatMoney(remaining)} sin asignar a ninguna factura`;
  }
  if (remaining < -0.01) {
    errors.abonos = `El total distribuido en facturas supera el monto del pago por ${formatMoney(Math.abs(remaining))}`;
  }

  return {
    errors,
    selectedAbonos: selectedAbonos.map(({ num_factura, valor_abono }) => ({
      num_factura,
      valor_abono,
    })),
  };
};
