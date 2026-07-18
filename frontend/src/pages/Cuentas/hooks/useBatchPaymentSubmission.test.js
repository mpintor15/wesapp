import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useBatchPaymentSubmission from './useBatchPaymentSubmission';

jest.mock('../../../services/cuentasService');

const makeBatchPayment = (overrides = {}) => ({
  customer: { id: 8 },
  date: '2026-07-09',
  totalCredit: '25',
  metodoPago: 'efectivo',
  notas: '  Pago parcial  ',
  invoices: [{ num_factura: 100, saldo_pendiente: '25' }],
  selections: { 100: { selected: true, amount: '25' } },
  totalPendiente: 25,
  remaining: 0,
  setErrors: jest.fn(),
  close: jest.fn(),
  ...overrides,
});

describe('useBatchPaymentSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasService.createBatchAbono.mockResolvedValue({
      success: true,
      message: 'Pagos registrados exitosamente',
    });
  });

  test('submit válido construye payload, cierra y refresca', async () => {
    const batchPayment = makeBatchPayment();
    const showToast = jest.fn();
    const onCreated = jest.fn();
    const hook = renderHook(() =>
      useBatchPaymentSubmission({ batchPayment, showToast, onCreated })
    );

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(cuentasService.createBatchAbono).toHaveBeenCalledWith({
      cliente_id: 8,
      fecha: '2026-07-09',
      metodo_pago: 'efectivo',
      notas: 'Pago parcial',
      abonos: [{ num_factura: 100, valor_abono: 25 }],
    });
    expect(showToast).toHaveBeenCalledWith('Pagos registrados exitosamente', 'success');
    expect(batchPayment.close).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalled();

    hook.unmount();
  });

  test('submit inválido setea errores y no ejecuta service', async () => {
    const batchPayment = makeBatchPayment({ customer: null });
    const showToast = jest.fn();
    const hook = renderHook(() =>
      useBatchPaymentSubmission({ batchPayment, showToast, onCreated: jest.fn() })
    );

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(cuentasService.createBatchAbono).not.toHaveBeenCalled();
    expect(batchPayment.setErrors).toHaveBeenCalledWith(
      expect.objectContaining({ cliente: expect.any(String) })
    );
    expect(showToast).toHaveBeenCalledWith(
      'Debes seleccionar un cliente antes de continuar',
      'error'
    );

    hook.unmount();
  });
});
