const ClientesReportModal = ({ isOpen, clientesCount, isExporting, onExport, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Generar Reporte de Clientes</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="report-body">
          <div className="clientes-report-summary">
            <div className="clientes-report-summary-row">
              <span className="clientes-report-summary-label">Clientes registrados</span>
              <span className="clientes-report-summary-value">{clientesCount}</span>
            </div>
            <p className="clientes-report-summary-note">
              Se exportará el listado completo de clientes en formato Excel.
            </p>
          </div>
          <div className="report-actions">
            <button type="button" className="ff-clear-btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
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

export default ClientesReportModal;
