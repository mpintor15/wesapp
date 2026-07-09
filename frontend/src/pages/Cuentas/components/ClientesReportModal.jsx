import AppModal from '../../../components/AppModal';

const ClientesReportModal = ({ isOpen, clientesCount, isExporting, onExport, onClose }) => {
  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      title="Generar reporte de Clientes"
      className="report-modal"
    >
      <AppModal.Header />
      <AppModal.Body className="report-body">
        <div className="clientes-report-summary">
          <div className="clientes-report-summary-row">
            <span className="clientes-report-summary-label">Clientes registrados</span>
            <span className="clientes-report-summary-value">{clientesCount}</span>
          </div>
          <p className="clientes-report-summary-note">
            Se exportará el listado completo de clientes en formato Excel.
          </p>
        </div>
      </AppModal.Body>
      <AppModal.Footer className="report-actions">
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
      </AppModal.Footer>
    </AppModal>
  );
};

export default ClientesReportModal;
