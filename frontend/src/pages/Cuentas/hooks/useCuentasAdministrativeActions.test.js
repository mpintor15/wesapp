import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useCuentasAdministrativeActions from './useCuentasAdministrativeActions';

jest.mock('../../../services/cuentasService');

const permissions = {
  canCancelFactura: true,
  canDeleteFactura: true,
  canDeletePago: true,
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
    cuentasService.deleteFactura.mockResolvedValue({ success: true });
    cuentasService.cancelFactura.mockResolvedValue({ success: true });
    cuentasService.deletePago.mockResolvedValue({ success: true });
  });

  test('elimina factura y limpia estado', async () => {
    const props = baseProps();
    const hook = renderHook(() => useCuentasAdministrativeActions(props));

    act(() => {
      hook.result.requestDeleteFactura({ num_factura: 10 });
    });

    await act(async () => {
      await hook.result.confirmDeleteFactura();
    });

    expect(cuentasService.deleteFactura).toHaveBeenCalledWith(10);
    expect(props.showToast).toHaveBeenCalledWith('Factura eliminada', 'success');
    expect(props.onRefresh).toHaveBeenCalled();
    expect(hook.result.facturaToDelete).toBeNull();

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

  test('elimina pago, abre/cierra detalles y respeta permisos de factura', async () => {
    const props = baseProps({
      permissions: { canCancelFactura: false, canDeleteFactura: false, canDeletePago: true },
    });
    const hook = renderHook(() => useCuentasAdministrativeActions(props));

    act(() => {
      hook.result.requestDeleteFactura({ num_factura: 1 });
      hook.result.openCancelFacturaModal({ num_factura: 1 });
      hook.result.openPagoDetailModal({ id: 3 });
      hook.result.requestDeletePago({ id: 9 });
    });

    expect(props.showToast).toHaveBeenCalledWith(
      'Solo un usuario Gerente puede eliminar facturas',
      'error'
    );
    expect(props.showToast).toHaveBeenCalledWith(
      'Solo un usuario Gerente puede anular facturas',
      'error'
    );
    expect(hook.result.selectedPago).toEqual({ id: 3 });

    act(() => {
      hook.result.closePagoDetailModal();
    });
    expect(hook.result.selectedPago).toBeNull();

    await act(async () => {
      await hook.result.confirmDeletePago();
    });

    expect(cuentasService.deletePago).toHaveBeenCalledWith(9);
    expect(props.showToast).toHaveBeenCalledWith('Pago eliminado exitosamente', 'success');

    hook.unmount();
  });
});
