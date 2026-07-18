import { useMemo, useState } from 'react';
import {
  calculateFacturaTotals,
  filterAndSortFacturas,
  paginateRows,
} from '../utils/cuentasFilters';
import { DEFAULT_FACTURA_FILTERS, ROWS_PER_PAGE } from '../utils/cuentasState';

const useFacturasTableState = (reporte) => {
  const [filters, setFilters] = useState(DEFAULT_FACTURA_FILTERS);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_FACTURA_FILTERS);
  const [sort, setSort] = useState({ field: '', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(
    () => filterAndSortFacturas(reporte, filters, sort),
    [filters, reporte, sort]
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const rows = paginateRows(filteredRows, currentPage, ROWS_PER_PAGE);
  const totals = calculateFacturaTotals(filteredRows);

  const handleSort = (field) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
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
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
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
    totals,
    setCurrentPage,
    handleSort,
    handleFilterChange,
    toggleFilter,
    clearFilters,
    applyFilters,
  };
};

export default useFacturasTableState;
