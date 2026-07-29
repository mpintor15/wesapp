import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useCuentasReports from './useCuentasReports';

jest.mock('../../../services/cuentasService');

describe('useCuentasReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasService.exportExcel.mockResolvedValue({ success: true });
    cuentasService.exportPagosExcel.mockResolvedValue({ success: true });
  });

  test('exporta facturas con parámetros y muestra éxito', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasReports({ showToast }));

    act(() => {
      hook.result.facturas.handleFilterChange({
        target: { name: 'fechaInicio', value: '2026-01-01', type: 'text' },
      });
      hook.result.facturas.toggleSoloDeudores();
    });

    await act(async () => {
      await hook.result.facturas.export();
    });

    expect(cuentasService.exportExcel).toHaveBeenCalledWith({
      fecha_inicio: '2026-01-01',
      solo_deudores: true,
    });
    expect(showToast).toHaveBeenCalledWith('Reporte exportado exitosamente', 'success');

    hook.unmount();
  });

  test('exporta pagos, cierra modal en éxito y omite parámetros vacíos', async () => {
    const showToast = jest.fn();
    const hook = renderHook(() => useCuentasReports({ showToast }));

    act(() => {
      hook.result.pagos.open();
      hook.result.pagos.handleFilterChange({
        target: { name: 'metodoPago', value: 'transferencia' },
      });
    });

    await act(async () => {
      await hook.result.pagos.export();
    });

    expect(cuentasService.exportPagosExcel).toHaveBeenCalledWith({
      metodo_pago: 'transferencia',
    });
    expect(showToast).toHaveBeenCalledWith('Reporte de pagos exportado exitosamente', 'success');
    expect(hook.result.pagos.isOpen).toBe(false);

    hook.unmount();
  });

  test('ignora cancelación de pagos sin mostrar error', async () => {
    const showToast = jest.fn();
    cuentasService.exportPagosExcel.mockResolvedValue({ success: false, cancelled: true });
    const hook = renderHook(() => useCuentasReports({ showToast }));

    await act(async () => {
      await hook.result.pagos.export();
    });

    expect(showToast).not.toHaveBeenCalled();

    hook.unmount();
  });

  test('muestra errores de exportación y limpia filtros', async () => {
    const showToast = jest.fn();
    cuentasService.exportExcel.mockResolvedValue({ success: false, message: '' });
    const hook = renderHook(() => useCuentasReports({ showToast }));

    act(() => {
      hook.result.facturas.handleFilterChange({
        target: { name: 'fechaFin', value: '2026-01-31', type: 'text' },
      });
      hook.result.facturas.clear();
    });

    expect(hook.result.facturas.filters.fechaFin).toBe('');

    await act(async () => {
      await hook.result.facturas.export();
    });

    expect(showToast).toHaveBeenCalledWith('Error al exportar', 'error');

    hook.unmount();
  });
});
