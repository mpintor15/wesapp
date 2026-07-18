import { act, renderHook } from '../../../testUtils/renderHook';
import useFacturasTableState from './useFacturasTableState';

const makeFacturas = (count) =>
  Array.from({ length: count }, (_, index) => ({
    num_factura: index + 1,
    cliente: index % 2 === 0 ? 'Ana' : 'Luis',
    fecha_factura: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    saldo_pendiente: index % 2 === 0 ? '10' : '0',
    subtotal: '100',
    iva: '15',
    por_cobrar: '115',
    total_abonos: '0',
    cancelada: false,
  }));

describe('useFacturasTableState', () => {
  test('mantiene filtros borrador separados de filtros aplicados', () => {
    const hook = renderHook(() => useFacturasTableState(makeFacturas(3)));

    act(() => {
      hook.result.handleFilterChange({ target: { name: 'search', value: 'Luis', type: 'text' } });
    });

    expect(hook.result.filters.search).toBe('');
    expect(hook.result.filtersDraft.search).toBe('Luis');

    act(() => {
      hook.result.applyFilters();
    });

    expect(hook.result.filters.search).toBe('Luis');
    expect(hook.result.currentPage).toBe(1);

    hook.unmount();
  });

  test('limpia filtros, ordena, pagina y calcula totales filtrados', () => {
    const hook = renderHook(() => useFacturasTableState(makeFacturas(55)));

    expect(hook.result.totalPages).toBe(1);
    expect(hook.result.rows).toHaveLength(28);
    expect(hook.result.totals.subtotal).toBe(2800);

    act(() => {
      hook.result.toggleFilter('conSaldo');
    });
    act(() => {
      hook.result.applyFilters();
      hook.result.setCurrentPage(2);
    });

    expect(hook.result.totalPages).toBe(2);
    expect(hook.result.rows).toHaveLength(5);

    act(() => {
      hook.result.handleSort('num_factura');
    });

    expect(hook.result.sort).toEqual({ field: 'num_factura', direction: 'asc' });

    act(() => {
      hook.result.handleSort('num_factura');
    });

    expect(hook.result.sort).toEqual({ field: 'num_factura', direction: 'desc' });

    act(() => {
      hook.result.clearFilters();
    });

    expect(hook.result.filters).toEqual(
      expect.objectContaining({ search: '', conSaldo: true, ordenAlfabetico: true })
    );
    expect(hook.result.currentPage).toBe(1);

    hook.unmount();
  });
});
