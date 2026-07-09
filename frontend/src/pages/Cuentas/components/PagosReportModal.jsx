import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';

const PagosReportModal = ({
  isOpen,
  filters,
  isExporting,
  onFilterChange,
  onClear,
  onExport,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      title="Generar reporte de Pagos"
      className="report-modal"
    >
      <AppModal.Header />
      <AppModal.Body className="report-body">
        <div className="ff-filter-card report-filters-inner pagos-report-filters">
          <div className="ff-date-field">
            <span className="ff-date-label">Desde</span>
            <FilterDateInput
              name="fechaInicio"
              value={filters.fechaInicio}
              onChange={onFilterChange}
            />
          </div>
          <div className="ff-date-field">
            <span className="ff-date-label">Hasta</span>
            <FilterDateInput name="fechaFin" value={filters.fechaFin} onChange={onFilterChange} />
          </div>
          <div className="ff-state">
            <span className="ff-state-label">Método</span>
            <select name="metodoPago" value={filters.metodoPago} onChange={onFilterChange}>
              <option value="">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
      </AppModal.Body>
      <AppModal.Footer className="report-actions">
        <button className="ff-clear-btn" type="button" onClick={onClear}>
          Limpiar
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <span className="spinner spinner--sm" />
              Generando…
            </>
          ) : (
            'Exportar reporte'
          )}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default PagosReportModal;
