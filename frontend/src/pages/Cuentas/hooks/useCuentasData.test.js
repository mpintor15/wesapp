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

  test('carga clientes y catálogo de facturas al iniciar, sin reporte ni pagos', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasData({ showToast }));

    await flushPromises();

    // Reporte y pagos dependen de filtros que solo el caller (Cuentas.jsx)
    // conoce; auto-cargarlos aquí sin filtros duplicaba y competía con el
    // fetch filtrado del caller (ver useCuentasData.js). Clientes y el
    // catálogo de facturas no dependen de filtros, por eso sí se precargan.
    expect(cuentasService.getReporte).not.toHaveBeenCalled();
    expect(cuentasService.getPagos).not.toHaveBeenCalled();
    expect(cuentasService.getClientes).toHaveBeenCalledTimes(1);
    expect(hook.result.reporte).toEqual([]);
    expect(hook.result.pagos).toEqual([]);
    expect(hook.result.clientes).toEqual([{ id: 3, nombre: 'Ana Torres' }]);
    expect(hook.result.pagosLoaded).toBe(false);
    expect(hook.result.clientesLoaded).toBe(true);

    hook.unmount();
  });

  test('loadReporte y loadPagos, invocados por el caller, conservan metadata paginada', async () => {
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

    await act(async () => {
      await hook.result.loadReporte();
      await hook.result.loadPagos();
    });

    expect(hook.result.reportePagination).toEqual(reportePagination);
    expect(hook.result.pagosPagination).toEqual(pagosPagination);
    expect(hook.result.pagosLoaded).toBe(true);
    expect(hook.result.facturasCatalogo).toEqual([{ num_factura: 3 }]);
    expect(cuentasService.getFacturasCatalogo).toHaveBeenCalledWith();

    hook.unmount();
  });

  test('loadReporte setea loadError y muestra toast si falla', async () => {
    const showToast = jest.fn();
    cuentasService.getReporte.mockResolvedValue({
      success: false,
      message: '',
    });

    const hook = renderHook(() => useCuentasData({ showToast }));
    await flushPromises();

    await act(async () => {
      await hook.result.loadReporte();
    });

    expect(hook.result.loadError).toBe('Error al cargar facturas');
    expect(showToast).toHaveBeenCalledWith('Error al cargar facturas', 'error');

    hook.unmount();
  });

  test('refreshFinancialData recarga reporte y pagos si pagos ya fue cargado', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasData({ showToast }));
    await flushPromises();
    await act(async () => {
      await hook.result.loadPagos();
    });
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
    await act(async () => {
      await hook.result.loadPagos();
    });
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
