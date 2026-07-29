import usePaginatedTableState from '../../../hooks/usePaginatedTableState';
import { filterAndSortPagos, paginateRows } from '../utils/cuentasFilters';
import { DEFAULT_PAGO_FILTERS, PAGOS_ROWS_PER_PAGE } from '../utils/cuentasState';

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

const getPagosSortParams = ({ filters, sort }) => ({
  sortBy: filters.agruparCliente ? 'cliente' : sort.field,
  sortOrder: filters.agruparCliente ? 'asc' : sort.direction,
});

const getInitialPagosSortDirection = (field) => (field === 'fecha' ? 'desc' : 'asc');

const usePagosTableState = (pagos, pagination = null) => {
  return usePaginatedTableState({
    initialFilters: DEFAULT_PAGO_FILTERS,
    initialPageSize: PAGOS_ROWS_PER_PAGE,
    initialSort: { field: 'fecha', direction: 'desc' },
    pagination,
    sourceRows: pagos,
    getLocalRows: filterAndSortPagos,
    paginateRows,
    buildFilters: buildPagosFilters,
    getSortParams: getPagosSortParams,
    getInitialSortDirection: getInitialPagosSortDirection,
  });
};

export default usePagosTableState;
