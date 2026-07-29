import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useCuentasAdministrativeActions from './useCuentasAdministrativeActions';

jest.mock('../../../services/cuentasService');

const permissions = {
  canCancelFactura: true,
};

const baseProps = (overrides = {}) => ({
  permissions,
  showToast: jest.fn(),
  onRefresh: jest.fn(),
  ...overrides,
});

describe('useCuentasAdministrativeActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasService.cancelFactura.mockResolvedValue({ success: true });
  });

  test('abre el modal de anulación de factura sin llamar eliminación', async () => {
    const props = baseProps();
    const hook = renderHook(() => useCuentasAdministrativeActions(props));

    act(() => {
      hook.result.openCancelFacturaModal({ num_factura: 10 });
    });

    expect(hook.result.facturaToCancel).toEqual({ num_factura: 10 });
    expect(hook.result.showCancelFacturaModal).toBe(true);

    hook.unmount();
  });

  test('anulación requiere detalle y envía payload preservado', async () => {
    const props = baseProps();
    const hook = renderHook(() => useCuentasAdministrativeActions(props));

    act(() => {
      hook.result.openCancelFacturaModal({ num_factura: 15 });
    });

    await act(async () => {
      await hook.result.confirmCancelFactura({ preventDefault: jest.fn() });
    });

    expect(cuentasService.cancelFactura).not.toHaveBeenCalled();
    expect(props.showToast).toHaveBeenCalledWith(
      'Debes ingresar el detalle de la anulación',
      'warning'
    );

    act(() => {
      hook.result.setCancelDetail('  Error de emisión  ');
    });

    await act(async () => {
      await hook.result.confirmCancelFactura({ preventDefault: jest.fn() });
    });

    expect(cuentasService.cancelFactura).toHaveBeenCalledWith(15, {
      detalle_anulacion: 'Error de emisión',
    });
    expect(props.showToast).toHaveBeenCalledWith('Factura anulada exitosamente', 'success');
    expect(hook.result.showCancelFacturaModal).toBe(false);

    hook.unmount();
  });

  test('abre/cierra detalles de pago y respeta permisos de factura', async () => {
    const props = baseProps({
      permissions: { canCancelFactura: false },
    });
    const hook = renderHook(() => useCuentasAdministrativeActions(props));

    act(() => {
      hook.result.openCancelFacturaModal({ num_factura: 1 });
      hook.result.openPagoDetailModal({ id: 3 });
    });

    expect(props.showToast).toHaveBeenCalledWith(
      'Solo un usuario Gerente puede anular facturas',
      'error'
    );
    expect(hook.result.selectedPago).toEqual({ id: 3 });

    act(() => {
      hook.result.closePagoDetailModal();
    });
    expect(hook.result.selectedPago).toBeNull();
    expect(hook.result.requestDeletePago).toBeUndefined();
    expect(hook.result.confirmDeletePago).toBeUndefined();
    expect(hook.result.requestDeleteFactura).toBeUndefined();

    hook.unmount();
  });
});
