import AppModal from '../../../components/AppModal';

const CancelFacturaModal = ({
  isOpen,
  factura,
  detail,
  isSubmitting,
  onDetailChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen || !factura) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      title="Anular Factura"
      size="lg"
      className="modal-cancel-factura"
    >
      <form onSubmit={onSubmit}>
        <AppModal.Header />
        <AppModal.Body>
          <div className="modal-context">
            <span>
              Factura: <strong>#{factura.num_factura}</strong>
            </span>
            <span>
              Cliente: <strong>{factura.cliente}</strong>
            </span>
          </div>
          <div className="form-group">
            <label>Detalle de anulación</label>
            <textarea
              value={detail}
              onChange={onDetailChange}
              placeholder="Explica por qué se anula la factura..."
              rows={4}
              maxLength={300}
            />
            <span className="field-help">{detail.length}/300</span>
          </div>
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner spinner--sm" />
                Anulando…
              </>
            ) : (
              'Confirmar anulación'
            )}
          </button>
          <button
            type="button"
            className="btn btn-modal-clear"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
};

export default CancelFacturaModal;
