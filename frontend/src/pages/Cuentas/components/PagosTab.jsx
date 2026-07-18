import PaginationControls from './PaginationControls';
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
  totalPages,
  canDeletePago,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onToggleFilter,
  onSort,
  onOpenDetail,
  onDelete,
  onPageChange,
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
      <div className="table-result-count">
        Mostrando {rows.length} de {filteredCount} pago(s)
      </div>
    ) : null}

    <PagosTable
      rows={rows}
      loading={loading}
      filters={filters}
      sort={sort}
      canDeletePago={canDeletePago}
      onSort={onSort}
      onOpenDetail={onOpenDetail}
      onDelete={onDelete}
    />

    {!loading && totalPages > 1 ? (
      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    ) : null}
  </div>
);

export default PagosTab;
