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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Generar reporte de Facturas</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="report-body">
          <div className="ff-filter-card report-filters-inner">
            <div className="ff-controls">
              <div className="ff-dates">
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

export default FacturasReportModal;
