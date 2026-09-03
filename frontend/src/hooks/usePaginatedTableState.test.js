import { act, renderHook } from '../testUtils/renderHook';
import usePaginatedTableState from './usePaginatedTableState';

const initialFilters = Object.freeze({
  search: '',
  estado: '',
  activo: true,
});

const makeRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    nombre: index % 2 === 0 ? 'Radio' : 'Casco',
    estado: index % 2 === 0 ? 'activo' : 'inactivo',
  }));

const buildFilters = (filters) => {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.estado) params.estado = filters.estado;
  if (filters.activo) params.activo = 'true';
  return params;
};

const filterRows = (rows, filters, sort) => {
  let nextRows = rows;
  if (filters.search) {
    nextRows = nextRows.filter((row) => row.nombre.includes(filters.search));
  }
  if (filters.estado) {
    nextRows = nextRows.filter((row) => row.estado === filters.estado);
  }
  return [...nextRows].sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return a[sort.field] > b[sort.field] ? direction : -direction;
  });
};

const paginateRows = (rows, page, pageSize) => rows.slice((page - 1) * pageSize, page * pageSize);

const renderPaginatedTable = (options = {}) =>
  renderHook(() =>
    usePaginatedTableState({
      initialFilters,
      initialPageSize: 25,
      initialSort: { field: 'id', direction: 'asc' },
      sourceRows: makeRows(60),
      getLocalRows: filterRows,
      paginateRows,
      buildFilters,
      ...options,
    })
  );

describe('usePaginatedTableState', () => {
  test('inicia con page 1, pageSize 25, filtros clonados y params exactos', () => {
    const hook = renderPaginatedTable();

    expect(hook.result.currentPage).toBe(1);
    expect(hook.result.pageSize).toBe(25);
    expect(hook.result.filters).toEqual(initialFilters);
    expect(hook.result.filters).not.toBe(initialFilters);
    expect(hook.result.params).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: 'id',
      sortOrder: 'asc',
      activo: 'true',
    });
    expect(hook.result.rows).toHaveLength(25);
    expect(hook.result.totalItems).toBe(60);
    expect(hook.result.totalPages).toBe(3);

    hook.unmount();
  });

  test('cambia de página sin alterar filtros ni sort', () => {
    const hook = renderPaginatedTable();

    act(() => {
      hook.result.setCurrentPage(2);
    });

    expect(hook.result.currentPage).toBe(2);
    expect(hook.result.params).toEqual(
      expect.objectContaining({ page: 2, pageSize: 25, sortBy: 'id', sortOrder: 'asc' })
    );

    hook.unmount();
  });

  test('cambiar pageSize reinicia a página 1', () => {
    const hook = renderPaginatedTable();

    act(() => {
      hook.result.setCurrentPage(3);
      hook.result.setPageSize(10);
    });

    expect(hook.result.currentPage).toBe(1);
    expect(hook.result.pageSize).toBe(10);

    hook.unmount();
  });

  test('búsqueda y filtros se aplican desde el borrador y reinician página', () => {
    const hook = renderPaginatedTable();

    act(() => {
      hook.result.setCurrentPage(2);
      hook.result.handleFilterChange({ target: { name: 'search', value: 'Radio', type: 'text' } });
      hook.result.handleFilterChange({
        target: { name: 'estado', value: 'activo', type: 'select-one' },
      });
    });
    act(() => {
      hook.result.applyFilters();
    });

    expect(hook.result.currentPage).toBe(1);
    expect(hook.result.filters).toEqual({
      search: 'Radio',
      estado: 'activo',
      activo: true,
    });
    expect(hook.result.params).toEqual(
      expect.objectContaining({ search: 'Radio', estado: 'activo', activo: 'true' })
    );

    hook.unmount();
  });

  test('toggleFilter no muta initialFilters y reset restaura valores vacíos', () => {
    const hook = renderPaginatedTable();

    act(() => {
      hook.result.toggleFilter('activo');
    });
    act(() => {
      hook.result.applyFilters();
    });
    expect(hook.result.filters.activo).toBe(false);
    expect(initialFilters.activo).toBe(true);

    act(() => {
      hook.result.clearFilters();
    });

    expect(hook.result.filters).toEqual(initialFilters);
    expect(hook.result.currentPage).toBe(1);

    hook.unmount();
  });

  test('ordenamiento alterna dirección y reinicia página', () => {
    const hook = renderPaginatedTable();

    act(() => {
      hook.result.setCurrentPage(2);
      hook.result.handleSort('id');
    });

    expect(hook.result.currentPage).toBe(1);
    expect(hook.result.sort).toEqual({ field: 'id', direction: 'desc' });

    act(() => {
      hook.result.handleSort('nombre');
    });

    expect(hook.result.sort).toEqual({ field: 'nombre', direction: 'asc' });

    hook.unmount();
  });

  test('permite dirección inicial específica por campo', () => {
    const hook = renderPaginatedTable({
      getInitialSortDirection: (field) => (field === 'id' ? 'desc' : 'asc'),
    });

    act(() => {
      hook.result.handleSort('nombre');
      hook.result.handleSort('id');
    });

    expect(hook.result.sort).toEqual({ field: 'id', direction: 'desc' });

    hook.unmount();
  });

  test('permite sort params derivados de filtros aplicados', () => {
    const hook = renderPaginatedTable({
      getSortParams: ({ filters, sort }) => ({
        sortBy: filters.activo ? 'nombre' : sort.field,
        sortOrder: filters.activo ? 'asc' : sort.direction,
      }),
    });

    expect(hook.result.params).toEqual(
      expect.objectContaining({ sortBy: 'nombre', sortOrder: 'asc' })
    );

    hook.unmount();
  });

  test('usa metadata explícita del backend y totalPages 0 en resultados vacíos', () => {
    const hook = renderPaginatedTable({
      sourceRows: [],
      pagination: {
        page: 3,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });

    expect(hook.result.rows).toEqual([]);
    expect(hook.result.filteredRows).toEqual([]);
    expect(hook.result.totalItems).toBe(0);
    expect(hook.result.totalPages).toBe(0);
    expect(hook.result.currentPage).toBe(1);

    hook.unmount();
  });

  test('mantiene dos instancias aisladas', () => {
    const first = renderPaginatedTable();
    const second = renderPaginatedTable();

    act(() => {
      first.result.handleFilterChange({ target: { name: 'search', value: 'Radio' } });
    });
    act(() => {
      first.result.applyFilters();
    });

    expect(first.result.filters.search).toBe('Radio');
    expect(second.result.filters.search).toBe('');

    first.unmount();
    second.unmount();
  });
});
