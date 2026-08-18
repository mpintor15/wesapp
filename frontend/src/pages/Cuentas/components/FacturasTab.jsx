import PaginationControls from '../../../components/PaginationControls';
import FacturaFilters from './FacturaFilters';
import FacturasTable from './FacturasTable';

const FacturasTab = ({
  filtersDraft,
  filters,
  rows,
  filteredCount,
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

    {filteredCount > 0 ? (
      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    ) : null}
  </div>
);

export default FacturasTab;
