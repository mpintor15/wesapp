import usePaginatedTableState from '../../../hooks/usePaginatedTableState';
import {
  calculateFacturaTotals,
  filterAndSortFacturas,
  paginateRows,
} from '../utils/cuentasFilters';
import { DEFAULT_FACTURA_FILTERS, ROWS_PER_PAGE } from '../utils/cuentasState';

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
  const table = usePaginatedTableState({
    initialFilters: DEFAULT_FACTURA_FILTERS,
    initialPageSize: ROWS_PER_PAGE,
    initialSort: { field: 'cliente', direction: 'asc' },
    pagination,
    sourceRows: reporte,
    getLocalRows: filterAndSortFacturas,
    paginateRows,
    buildFilters: buildReporteFilters,
  });

  const totals = calculateFacturaTotals(table.filteredRows);

  return {
    ...table,
    totals,
  };
};

export default useFacturasTableState;
