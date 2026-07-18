import { useEffect, useMemo, useState } from 'react';
import { filterAndSortPagos, paginateRows } from '../utils/cuentasFilters';
import { DEFAULT_PAGO_FILTERS, PAGOS_ROWS_PER_PAGE } from '../utils/cuentasState';

const usePagosTableState = (pagos) => {
  const [filters, setFilters] = useState(DEFAULT_PAGO_FILTERS);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_PAGO_FILTERS);
  const [sort, setSort] = useState({ field: 'fecha', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(
    () => filterAndSortPagos(pagos, filters, sort),
    [filters, pagos, sort]
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGOS_ROWS_PER_PAGE));
  const rows = paginateRows(filteredRows, currentPage, PAGOS_ROWS_PER_PAGE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleSort = (field) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: field === 'fecha' ? 'desc' : 'asc' };
    });
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
  };

  const clearFilters = () => {
    const cleared = { ...DEFAULT_PAGO_FILTERS };
    setFiltersDraft(cleared);
    setFilters(cleared);
    setCurrentPage(1);
  };

  return {
    filters,
    filtersDraft,
    sort,
    currentPage,
    filteredRows,
    rows,
    totalPages,
    setCurrentPage,
    handleSort,
    handleFilterChange,
    toggleFilter,
    applyFilters,
    clearFilters,
  };
};

export default usePagosTableState;
