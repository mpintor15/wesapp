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

  test('conserva metadata paginada de reporte y pagos y carga catálogo separado', async () => {
    const reportePagination = {
      page: 1,
      pageSize: 25,
      totalItems: 40,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    };
    const pagosPagination = {
      page: 2,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    };
    cuentasService.getReporte.mockResolvedValue({
      success: true,
      data: [{ num_factura: 1 }],
      pagination: reportePagination,
    });
    cuentasService.getPagos.mockResolvedValue({
      success: true,
      data: [{ id: 2 }],
      pagination: pagosPagination,
    });
    cuentasService.getFacturasCatalogo.mockResolvedValue({
      success: true,
      data: [{ num_factura: 3 }],
    });
    const showToast = jest.fn();

    const hook = renderHook(() => useCuentasData({ showToast }));

    await flushPromises();

    expect(hook.result.reportePagination).toEqual(reportePagination);
    expect(hook.result.pagosPagination).toEqual(pagosPagination);
    expect(hook.result.facturasCatalogo).toEqual([{ num_factura: 3 }]);
    expect(cuentasService.getFacturasCatalogo).toHaveBeenCalledWith();

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

  test('refreshFinancialData pasa parámetros paginados a reporte y pagos', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasData({ showToast }));
    await flushPromises();
    jest.clearAllMocks();
    mockSuccessResponses();

    await act(async () => {
      await hook.result.refreshFinancialData(
        { page: 2, pageSize: 50, sortBy: 'cliente' },
        { page: 3, pageSize: 25, metodo_pago: 'efectivo' }
      );
    });

    expect(cuentasService.getReporte).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      sortBy: 'cliente',
    });
    expect(cuentasService.getPagos).toHaveBeenCalledWith({
      page: 3,
      pageSize: 25,
      metodo_pago: 'efectivo',
    });
    expect(cuentasService.getFacturasCatalogo).toHaveBeenCalledWith();

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
