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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Generar Reporte de Pagos</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="report-body">
          <div className="ff-filter-card report-filters-inner pagos-report-filters">
            <div className="ff-date-field">
              <span className="ff-date-label">Desde</span>
              <input
                type="date"
                name="fechaInicio"
                value={filters.fechaInicio}
                onChange={onFilterChange}
              />
            </div>
            <div className="ff-date-field">
              <span className="ff-date-label">Hasta</span>
              <input
                type="date"
                name="fechaFin"
                value={filters.fechaFin}
                onChange={onFilterChange}
              />
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
          <div className="report-actions">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagosReportModal;
