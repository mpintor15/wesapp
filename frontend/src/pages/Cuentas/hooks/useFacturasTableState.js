import { useEffect, useMemo, useState } from 'react';
import {
  calculateFacturaTotals,
  filterAndSortFacturas,
  paginateRows,
} from '../utils/cuentasFilters';
import { DEFAULT_FACTURA_FILTERS, ROWS_PER_PAGE } from '../utils/cuentasState';
import { withPaginationParams } from '../../../utils/pagination';

const buildReporteFilters = (filters) => {
  const params = {};
  if (filters.fechaInicio && filters.fechaFin) {
    params.fecha_inicio = filters.fechaInicio;
    params.fecha_fin = filters.fechaFin;
  }
  if (filters.conSaldo) params.solo_deudores = 'true';
  if (filters.ordenAlfabetico) params.agrupar_cliente = 'true';
  if (filters.estado) params.estado = filters.estado;
  if (filters.search) params.search = filters.search;
  return params;
};

const useFacturasTableState = (reporte, pagination = null) => {
  const [filters, setFilters] = useState(DEFAULT_FACTURA_FILTERS);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_FACTURA_FILTERS);
  const [sort, setSort] = useState({ field: 'cliente', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(ROWS_PER_PAGE);

  const localRows = useMemo(
    () => (pagination ? reporte : filterAndSortFacturas(reporte, filters, sort)),
    [filters, pagination, reporte, sort]
  );
  const rows = pagination ? reporte : paginateRows(localRows, currentPage, pageSize);
  const totalItems = pagination?.totalItems ?? localRows.length;
  const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(localRows.length / pageSize));
  const filteredRows = pagination ? reporte : localRows;
  const totals = calculateFacturaTotals(filteredRows);
  const params = useMemo(
    () =>
      withPaginationParams({
        page: currentPage,
        pageSize,
        sortBy: sort.field,
        sortOrder: sort.direction,
        filters: buildReporteFilters(filters),
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
        : { field, direction: 'asc' };
    setSort(nextSort);
    setCurrentPage(1);
    return nextSort;
  };

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFiltersDraft((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleFilter = (field) => {
    setFiltersDraft((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const clearFilters = () => {
    const cleared = { ...DEFAULT_FACTURA_FILTERS };
    setFiltersDraft(cleared);
    setFilters(cleared);
    setCurrentPage(1);
    return cleared;
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
    setCurrentPage(1);
    return filtersDraft;
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
    totals,
    totalItems,
    params,
    setCurrentPage,
    setPageSize,
    handleSort,
    handleFilterChange,
    toggleFilter,
    clearFilters,
    applyFilters,
  };
};

export default useFacturasTableState;
