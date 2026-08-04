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
  test('inicializa filtros obligatorios activos y construye consulta inicial', () => {
    const hook = renderHook(() => useFacturasTableState(makeFacturas(3)));

    expect(hook.result.filters).toEqual(
      expect.objectContaining({ conSaldo: true, ordenAlfabetico: true })
    );
    expect(hook.result.filtersDraft).toEqual(
      expect.objectContaining({ conSaldo: true, ordenAlfabetico: true })
    );
    expect(hook.result.params).toEqual(
      expect.objectContaining({
        page: 1,
        solo_deudores: 'true',
        agrupar_cliente: 'true',
      })
    );

    hook.unmount();
  });

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

    expect(hook.result.totalPages).toBe(2);
    expect(hook.result.rows).toHaveLength(25);
    expect(hook.result.totals.subtotal).toBe(2800);

    act(() => {
      hook.result.toggleFilter('conSaldo');
    });
    act(() => {
      hook.result.applyFilters();
      hook.result.setCurrentPage(2);
    });

    expect(hook.result.totalPages).toBe(3);
    expect(hook.result.rows).toHaveLength(25);

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
    expect(hook.result.filtersDraft).toEqual(
      expect.objectContaining({ search: '', conSaldo: true, ordenAlfabetico: true })
    );
    expect(hook.result.params).toEqual(
      expect.objectContaining({ solo_deudores: 'true', agrupar_cliente: 'true' })
    );
    expect(hook.result.currentPage).toBe(1);

    hook.unmount();
  });

  test('usa metadata del backend y construye parámetros para facturas paginadas', () => {
    const hook = renderHook(() =>
      useFacturasTableState(makeFacturas(2), {
        page: 2,
        pageSize: 25,
        totalItems: 80,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      })
    );

    expect(hook.result.rows).toHaveLength(2);
    expect(hook.result.totalItems).toBe(80);
    expect(hook.result.totalPages).toBe(4);

    act(() => {
      hook.result.handleFilterChange({ target: { name: 'search', value: 'Acme', type: 'text' } });
      hook.result.toggleFilter('ordenAlfabetico');
      hook.result.handleFilterChange({
        target: { name: 'estado', value: 'anulada', type: 'select-one' },
      });
    });
    act(() => {
      hook.result.applyFilters();
      hook.result.setPageSize(50);
      hook.result.setCurrentPage(3);
    });

    expect(hook.result.params).toEqual({
      page: 3,
      pageSize: 50,
      sortBy: 'cliente',
      sortOrder: 'asc',
      solo_deudores: 'true',
      estado: 'anulada',
      search: 'Acme',
    });

    act(() => {
      hook.result.clearFilters();
    });

    expect(hook.result.params).toEqual(
      expect.objectContaining({
        page: 1,
        solo_deudores: 'true',
        agrupar_cliente: 'true',
      })
    );

    hook.unmount();
  });
});
