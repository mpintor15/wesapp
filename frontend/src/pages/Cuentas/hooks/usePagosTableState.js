import { useEffect, useMemo, useState } from 'react';
import { filterAndSortPagos, paginateRows } from '../utils/cuentasFilters';
import { DEFAULT_PAGO_FILTERS, PAGOS_ROWS_PER_PAGE } from '../utils/cuentasState';
import { withPaginationParams } from '../../../utils/pagination';

const buildPagosFilters = (filters) => {
  const params = {};
  if (filters.fechaInicio && filters.fechaFin) {
    params.fecha_inicio = filters.fechaInicio;
    params.fecha_fin = filters.fechaFin;
  }
  if (filters.metodoPago) params.metodo_pago = filters.metodoPago;
  if (filters.search) params.search = filters.search;
  return params;
};

const usePagosTableState = (pagos, pagination = null) => {
  const [filters, setFilters] = useState(DEFAULT_PAGO_FILTERS);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_PAGO_FILTERS);
  const [sort, setSort] = useState({ field: 'fecha', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGOS_ROWS_PER_PAGE);

  const localRows = useMemo(
    () => (pagination ? pagos : filterAndSortPagos(pagos, filters, sort)),
    [filters, pagination, pagos, sort]
  );
  const filteredRows = pagination ? pagos : localRows;
  const totalItems = pagination?.totalItems ?? localRows.length;
  const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const rows = pagination ? pagos : paginateRows(localRows, currentPage, pageSize);
  const params = useMemo(
    () =>
      withPaginationParams({
        page: currentPage,
        pageSize,
        sortBy: filters.agruparCliente ? 'cliente' : sort.field,
        sortOrder: filters.agruparCliente ? 'asc' : sort.direction,
        filters: buildPagosFilters(filters),
      }),
    [currentPage, filters, pageSize, sort]
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const handleSort = (field) => {
    const nextSort =
      sort.field === field
        ? { field, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: field === 'fecha' ? 'desc' : 'asc' };
    setSort(nextSort);
    setCurrentPage(1);
    return nextSort;
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFiltersDraft((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleFilter = (field) => {
    setFiltersDraft((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
    setCurrentPage(1);
    return filtersDraft;
  };

  const clearFilters = () => {
    const cleared = { ...DEFAULT_PAGO_FILTERS };
    setFiltersDraft(cleared);
    setFilters(cleared);
    setCurrentPage(1);
    return cleared;
  };

  return {
    filters,
    filtersDraft,
    sort,
    currentPage,
    pageSize,
    filteredRows,
    rows,
    totalPages,
    totalItems,
    params,
    setCurrentPage,
    setPageSize,
    handleSort,
    handleFilterChange,
    toggleFilter,
    applyFilters,
    clearFilters,
  };
};

export default usePagosTableState;
