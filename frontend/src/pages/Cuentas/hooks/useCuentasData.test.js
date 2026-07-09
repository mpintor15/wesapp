import cuentasService from '../../../services/cuentasService';
import { act, flushPromises, renderHook } from '../../../testUtils/renderHook';
import useCuentasData from './useCuentasData';

jest.mock('../../../services/cuentasService');

const mockSuccessResponses = () => {
  cuentasService.getReporte.mockResolvedValue({
    success: true,
    data: [{ num_factura: 1 }],
  });
  cuentasService.getPagos.mockResolvedValue({
    success: true,
    data: [{ id: 2 }],
  });
  cuentasService.getClientes.mockResolvedValue({
    success: true,
    data: [{ id: 3, nombre: 'Ana Torres' }],
  });
};

describe('useCuentasData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSuccessResponses();
  });

  test('carga reporte, pagos y clientes al iniciar', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasData({ showToast }));

    await flushPromises();

    expect(cuentasService.getReporte).toHaveBeenCalledTimes(1);
    expect(cuentasService.getPagos).toHaveBeenCalledTimes(1);
    expect(cuentasService.getClientes).toHaveBeenCalledTimes(1);
    expect(hook.result.reporte).toEqual([{ num_factura: 1 }]);
    expect(hook.result.pagos).toEqual([{ id: 2 }]);
    expect(hook.result.clientes).toEqual([{ id: 3, nombre: 'Ana Torres' }]);
    expect(hook.result.loading).toBe(false);
    expect(hook.result.pagosLoaded).toBe(true);
    expect(hook.result.clientesLoaded).toBe(true);

    hook.unmount();
  });

  test('setea loadError y muestra toast si falla reporte', async () => {
    const showToast = jest.fn();
    cuentasService.getReporte.mockResolvedValue({
      success: false,
      message: '',
    });

    const hook = renderHook(() => useCuentasData({ showToast }));
    await flushPromises();

    expect(hook.result.loadError).toBe('Error al cargar facturas');
    expect(showToast).toHaveBeenCalledWith('Error al cargar facturas', 'error');

    hook.unmount();
  });

  test('refreshFinancialData recarga reporte y pagos si pagos ya fue cargado', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasData({ showToast }));
    await flushPromises();
    jest.clearAllMocks();
    mockSuccessResponses();

    await act(async () => {
      await hook.result.refreshFinancialData();
    });

    expect(cuentasService.getReporte).toHaveBeenCalledTimes(1);
    expect(cuentasService.getPagos).toHaveBeenCalledTimes(1);
    expect(cuentasService.getClientes).not.toHaveBeenCalled();

    hook.unmount();
  });

  test('refreshFinancialData no recarga pagos si pagosLoaded es false', async () => {
    const showToast = jest.fn();
    cuentasService.getPagos.mockResolvedValue({
      success: false,
      message: 'Error de pagos',
    });
    const hook = renderHook(() => useCuentasData({ showToast }));
    await flushPromises();
    jest.clearAllMocks();
    mockSuccessResponses();

    await act(async () => {
      await hook.result.refreshFinancialData();
    });

    expect(cuentasService.getReporte).toHaveBeenCalledTimes(1);
    expect(cuentasService.getPagos).not.toHaveBeenCalled();

    hook.unmount();
  });
});
