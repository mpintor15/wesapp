import { act, renderHook } from '../../../testUtils/renderHook';
import usePagosTableState from './usePagosTableState';

const makePagos = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    cliente_id: index % 2,
    cliente: index % 2 === 0 ? 'Ana' : 'Luis',
    fecha: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    metodo_pago: index % 2 === 0 ? 'efectivo' : 'transferencia',
    total: String(index + 1),
  }));

describe('usePagosTableState', () => {
  test('usa orden inicial por fecha descendente y alterna dirección', () => {
    const hook = renderHook(() => usePagosTableState(makePagos(3)));

    expect(hook.result.sort).toEqual({ field: 'fecha', direction: 'desc' });

    act(() => {
      hook.result.handleSort('fecha');
    });

    expect(hook.result.sort).toEqual({ field: 'fecha', direction: 'asc' });

    act(() => {
      hook.result.handleSort('total');
    });

    expect(hook.result.sort).toEqual({ field: 'total', direction: 'asc' });

    hook.unmount();
  });

  test('aplica, limpia, pagina y ajusta página fuera de rango', () => {
    let pagos = makePagos(55);
    const hook = renderHook(() => usePagosTableState(pagos));

    act(() => {
      hook.result.toggleFilter('agruparCliente');
    });
    act(() => {
      hook.result.applyFilters();
      hook.result.setCurrentPage(2);
    });

    expect(hook.result.totalPages).toBe(3);
    expect(hook.result.rows).toHaveLength(25);

    act(() => {
      hook.result.handleFilterChange({
        target: { name: 'metodoPago', value: 'efectivo' },
      });
    });
    act(() => {
      hook.result.applyFilters();
    });

    expect(hook.result.currentPage).toBe(1);
    expect(hook.result.filteredRows.every((pago) => pago.metodo_pago === 'efectivo')).toBe(true);

    act(() => {
      hook.result.clearFilters();
      hook.result.toggleFilter('agruparCliente');
    });
    act(() => {
      hook.result.applyFilters();
      hook.result.setCurrentPage(2);
    });

    pagos = makePagos(10);
    hook.rerender();

    expect(hook.result.currentPage).toBe(1);

    act(() => {
      hook.result.clearFilters();
    });

    expect(hook.result.filters).toEqual(
      expect.objectContaining({ search: '', metodoPago: '', agruparCliente: true })
    );
    expect(hook.result.currentPage).toBe(1);

    hook.unmount();
  });

  test('usa metadata del backend y construye parámetros para pagos paginados', () => {
    const hook = renderHook(() =>
      usePagosTableState(makePagos(2), {
        page: 1,
        pageSize: 25,
        totalItems: 64,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      })
    );

    expect(hook.result.rows).toHaveLength(2);
    expect(hook.result.totalItems).toBe(64);
    expect(hook.result.totalPages).toBe(3);

    act(() => {
      hook.result.handleFilterChange({
        target: { name: 'metodoPago', value: 'transferencia' },
      });
      hook.result.handleFilterChange({
        target: { name: 'search', value: 'Luis' },
      });
    });
    act(() => {
      hook.result.applyFilters();
      hook.result.setPageSize(100);
      hook.result.setCurrentPage(2);
    });

    expect(hook.result.params).toEqual({
      page: 2,
      pageSize: 100,
      sortBy: 'cliente',
      sortOrder: 'asc',
      metodo_pago: 'transferencia',
      search: 'Luis',
    });

    hook.unmount();
  });
});
