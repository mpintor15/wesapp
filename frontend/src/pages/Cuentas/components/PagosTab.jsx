import PaginationControls from '../../../components/PaginationControls';
import PagoFilters from './PagoFilters';
import PagosTable from './PagosTable';

const PagosTab = ({
  filtersDraft,
  filters,
  rows,
  filteredCount,
  loading,
  sort,
  currentPage,
  pageSize,
  totalPages,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onToggleFilter,
  onSort,
  onOpenDetail,
  onPageChange,
  onPageSizeChange,
}) => (
  <div className="tab-content">
    <PagoFilters
      filters={filtersDraft}
      onFilterChange={onFilterChange}
      onApply={onApplyFilters}
      onClear={onClearFilters}
      onToggle={onToggleFilter}
    />

    {!loading ? (
      <div className="cuentas-tab-summary">
        <span className="table-result-count">
          Mostrando {rows.length} de {filteredCount} pago(s)
        </span>
        <span className="payment-history-note" title="Los pagos no se anulan desde esta vista.">
          Los pagos registrados se conservan como parte del historial contable.
        </span>
      </div>
    ) : null}

    <PagosTable
      rows={rows}
      loading={loading}
      filters={filters}
      sort={sort}
      onSort={onSort}
      onOpenDetail={onOpenDetail}
    />

    {!loading && totalPages > 1 ? (
      <PaginationControls
        page={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    ) : null}
  </div>
);

export default PagosTab;
