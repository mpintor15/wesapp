import LoadingState from '../../../components/LoadingState';
import PaginationControls from '../../../components/PaginationControls';
import FacturaFilters from './FacturaFilters';
import FacturasTable from './FacturasTable';

const FacturasTab = ({
  filtersDraft,
  filters,
  rows,
  filteredCount,
  loading = false,
  sort,
  currentPage,
  totalPages,
  totals,
  canManageFacturas,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onToggleFilter,
  onSort,
  onShowAnulacion,
  onEdit,
  onCancel,
  onDelete,
  onPageChange,
}) => (
  <div className="tab-content tabular-workspace">
    <FacturaFilters
      filters={filtersDraft}
      onFilterChange={onFilterChange}
      onApply={onApplyFilters}
      onClear={onClearFilters}
      onToggle={onToggleFilter}
    />

    <LoadingState
      loading={loading}
      hasRows={rows.length > 0}
      refreshMessage="Actualizando facturas…"
    />

    <div className="table-result-count">
      Mostrando {rows.length} de {filteredCount} factura(s)
    </div>

    <FacturasTable
      rows={rows}
      filteredCount={filteredCount}
      filters={filters}
      sort={sort}
      currentPage={currentPage}
      totalPages={totalPages}
      totals={totals}
      canManageFacturas={canManageFacturas}
      onSort={onSort}
      onShowAnulacion={onShowAnulacion}
      onEdit={onEdit}
      onCancel={onCancel}
      onDelete={onDelete}
    />

    <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
  </div>
);

export default FacturasTab;
