import {
  autoDistribute,
  calculateBatchPaymentSummary,
  getPendingInvoicesForCustomer,
  validateBatchPaymentForm,
} from './cuentasBatchPayment';

const invoices = [
  { num_factura: 10, cliente_id: 1, fecha_factura: '2026-02-02', saldo_pendiente: '40.00' },
  { num_factura: 9, cliente_id: 1, fecha_factura: '2026-01-01', saldo_pendiente: '30.00' },
  { num_factura: 11, cliente_id: 1, fecha_factura: '2026-03-01', saldo_pendiente: '0.00' },
  { num_factura: 12, cliente_id: 2, fecha_factura: '2026-01-01', saldo_pendiente: '100.00' },
  {
    num_factura: 13,
    cliente_id: 1,
    fecha_factura: '2026-01-01',
    saldo_pendiente: '10.00',
    cancelada: true,
  },
];

describe('cuentasBatchPayment', () => {
  test('obtiene facturas pendientes por cliente, no canceladas y ordenadas', () => {
    expect(
      getPendingInvoicesForCustomer(invoices, { id: 1 }).map((invoice) => invoice.num_factura)
    ).toEqual([9, 10]);
  });

  test('distribuye monto disponible sin exceder saldos', () => {
    expect(autoDistribute('50', invoices.slice(0, 2))).toEqual({
      10: { selected: true, amount: '40.00' },
      9: { selected: true, amount: '10.00' },
    });
  });

  test('desmarca facturas cuando el monto restante se agota', () => {
    expect(autoDistribute('30', invoices.slice(0, 2))).toEqual({
      10: { selected: true, amount: '30.00' },
      9: { selected: false, amount: '' },
    });
  });

  test('calcula total pendiente, asignado y restante', () => {
    expect(
      calculateBatchPaymentSummary(
        invoices.slice(0, 2),
        {
          10: { selected: true, amount: '25.50' },
          9: { selected: false, amount: '30.00' },
        },
        '40'
      )
    ).toEqual({
      totalPendiente: 70,
      totalAllocated: 25.5,
      remaining: 14.5,
    });
  });

  test('valida pago por lote exitoso y devuelve abonos seleccionados', () => {
    const result = validateBatchPaymentForm({
      customer: { id: 1 },
      date: '2026-07-09',
      totalCredit: '40',
      notas: 'Pago parcial',
      invoices: invoices.slice(0, 2),
      selections: {
        10: { selected: true, amount: '40.00' },
        9: { selected: false, amount: '' },
      },
      totalPendiente: 70,
      remaining: 0,
    });

    expect(result.errors).toEqual({});
    expect(result.selectedAbonos).toEqual([{ num_factura: 10, valor_abono: 40 }]);
  });

  test('detecta pago sin cliente, fecha, monto válido y distribución completa', () => {
    const result = validateBatchPaymentForm({
      customer: null,
      date: '',
      totalCredit: '80',
      notas: 'x'.repeat(501),
      invoices: invoices.slice(0, 1),
      selections: { 10: { selected: true, amount: '50.00' } },
      totalPendiente: 40,
      remaining: -10,
    });

    expect(result.errors).toEqual(
      expect.objectContaining({
        cliente: expect.any(String),
        fecha: expect.any(String),
        total: expect.stringMatching(/supera/),
        notas: expect.stringMatching(/500/),
        amount_10: expect.stringMatching(/saldo/),
        abonos: expect.stringMatching(/supera/),
      })
    );
  });
});
