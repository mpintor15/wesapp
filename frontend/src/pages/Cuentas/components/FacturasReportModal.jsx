import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';

const FacturasReportModal = ({
  isOpen,
  filters,
  isExporting,
  onFilterChange,
  onToggleSoloDeudores,
  onToggleAgruparCliente,
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
      title="Generar reporte de Facturas"
      className="report-modal"
    >
      <AppModal.Header />
      <AppModal.Body className="report-body">
        <div className="ff-filter-card report-filters-inner">
          <div className="ff-controls">
            <div className="ff-dates">
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
                <FilterDateInput
                  name="fechaFin"
                  value={filters.fechaFin}
                  onChange={onFilterChange}
                />
              </div>
            </div>
            <div className="ff-pills">
              <button
                type="button"
                className={`ff-pill${filters.soloDeudores ? ' active' : ''}`}
                onClick={onToggleSoloDeudores}
              >
                Solo con saldo
              </button>
              <button
                type="button"
                className={`ff-pill${filters.agruparCliente ? ' active' : ''}`}
                onClick={onToggleAgruparCliente}
              >
                Agrupar por cliente
              </button>
            </div>
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

export default FacturasReportModal;
