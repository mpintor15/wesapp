import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useFacturaEditing from './useFacturaEditing';

jest.mock('../../../services/cuentasService');

const factura = {
  num_factura: 22,
  cliente_id: 3,
  cliente: 'Ana Torres',
  fecha_factura: '2026-07-09T05:00:00.000Z',
  subtotal: '100',
  incluye_iva: true,
  incluye_retencion_fuente: false,
  incluye_retencion_iva: true,
};

const baseProps = (overrides = {}) => ({
  canEditFactura: true,
  showToast: jest.fn(),
  onUpdated: jest.fn(),
  ...overrides,
});

describe('useFacturaEditing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasService.updateFactura.mockResolvedValue({ success: true });
  });

  test('apertura transforma factura y cierre limpia estado', () => {
    const props = baseProps();
    const hook = renderHook(() => useFacturaEditing(props));

    act(() => {
      hook.result.open(factura);
    });

    expect(hook.result.isOpen).toBe(true);
    expect(hook.result.formData).toEqual(
      expect.objectContaining({
        cliente_id: '3',
        fecha_factura: '2026-07-09',
        valor_factura: '100',
      })
    );

    act(() => {
      hook.result.close();
    });

    expect(hook.result.isOpen).toBe(false);
    expect(hook.result.factura).toBeNull();
    expect(hook.result.formData).toEqual({});

    hook.unmount();
  });

  test('campo checkbox mantiene regla de retención IVA', () => {
    const hook = renderHook(() => useFacturaEditing(baseProps()));

    act(() => {
      hook.result.open(factura);
      hook.result.handleFormChange({
        target: { name: 'incluye_iva', type: 'checkbox', checked: false },
      });
    });

    expect(hook.result.formData.incluye_iva).toBe(false);
    expect(hook.result.formData.incluye_retencion_iva).toBe(false);

    hook.unmount();
  });

  test('campos requeridos y subtotal inválido no ejecutan service', async () => {
    const props = baseProps();
    const hook = renderHook(() => useFacturaEditing(props));

    act(() => {
      hook.result.open(factura);
      hook.result.handleFormChange({ target: { name: 'valor_factura', value: '', type: 'text' } });
    });

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(cuentasService.updateFactura).not.toHaveBeenCalled();
    expect(props.showToast).toHaveBeenCalledWith('Todos los campos son requeridos', 'error');

    act(() => {
      hook.result.handleFormChange({ target: { name: 'valor_factura', value: '0', type: 'text' } });
    });

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(cuentasService.updateFactura).not.toHaveBeenCalled();
    expect(props.showToast).toHaveBeenCalledWith('El subtotal debe ser mayor a 0', 'error');

    hook.unmount();
  });

  test('submit exitoso envía payload exacto, cierra y refresca', async () => {
    const props = baseProps();
    const hook = renderHook(() => useFacturaEditing(props));

    act(() => {
      hook.result.open(factura);
      hook.result.handleFormChange({
        target: { name: 'valor_factura', value: '150.25', type: 'text' },
      });
    });

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(cuentasService.updateFactura).toHaveBeenCalledWith(22, {
      cliente_id: 3,
      fecha_factura: '2026-07-09',
      valor_factura: 150.25,
      incluye_iva: true,
      incluye_retencion_fuente: false,
      incluye_retencion_iva: true,
    });
    expect(props.showToast).toHaveBeenCalledWith('Factura actualizada exitosamente', 'success');
    expect(props.onUpdated).toHaveBeenCalled();
    expect(hook.result.isOpen).toBe(false);

    hook.unmount();
  });

  test('error conserva modal y muestra mensaje', async () => {
    const props = baseProps();
    cuentasService.updateFactura.mockResolvedValue({ success: false, message: 'No se pudo' });
    const hook = renderHook(() => useFacturaEditing(props));

    act(() => {
      hook.result.open(factura);
    });

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(hook.result.isOpen).toBe(true);
    expect(props.showToast).toHaveBeenCalledWith('No se pudo', 'error');

    hook.unmount();
  });

  test('usuario sin permiso no ejecuta service', async () => {
    const props = baseProps({ canEditFactura: false });
    const hook = renderHook(() => useFacturaEditing(props));

    act(() => {
      hook.result.open(factura);
    });

    await act(async () => {
      await hook.result.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(cuentasService.updateFactura).not.toHaveBeenCalled();
    expect(props.showToast).toHaveBeenCalledWith(
      'Solo un usuario Gerente puede editar facturas',
      'error'
    );

    hook.unmount();
  });
});
