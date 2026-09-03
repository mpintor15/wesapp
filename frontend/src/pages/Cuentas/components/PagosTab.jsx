import { useEffect, useState } from 'react';
import LoadingState from '../../../components/LoadingState';
import PaginationControls from '../../../components/PaginationControls';
import PagoInvoicesPanel from './PagoInvoicesPanel';
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
  selectionResetKey,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  onToggleFilter,
  onSort,
  onPageChange,
}) => {
  const [selectedPagoId, setSelectedPagoId] = useState(null);
  const selectedPago = rows.find((pago) => pago.id === selectedPagoId) || null;

  useEffect(() => {
    if (selectedPagoId !== null && !selectedPago) {
      setSelectedPagoId(null);
    }
  }, [selectedPago, selectedPagoId]);

  useEffect(() => {
    setSelectedPagoId(null);
  }, [selectionResetKey]);

  return (
    <div className="tab-content tabular-workspace">
      <PagoFilters
        filters={filtersDraft}
        onFilterChange={onFilterChange}
        onApply={onApplyFilters}
        onClear={onClearFilters}
        onToggle={onToggleFilter}
      />

      <LoadingState
        loading={loading}
        hasRows={rows.length > 0}
        refreshMessage="Actualizando pagos…"
      />

      <div className="cuentas-tab-summary">
        <span className="table-result-count">
          Mostrando {rows.length} de {filteredCount} pago(s)
        </span>
        <span className="payment-history-note" title="Los pagos no se anulan desde esta vista.">
          Los pagos registrados se conservan como parte del historial contable.
        </span>
      </div>

      <div className="pagos-master-detail">
        <PagosTable
          rows={rows}
          loading={loading}
          filters={filters}
          sort={sort}
          selectedPagoId={selectedPagoId}
          onSort={onSort}
          onSelectPago={(pago) => setSelectedPagoId(pago.id)}
        />
        <PagoInvoicesPanel pago={selectedPago} />
      </div>

      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
};

export default PagosTab;
