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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-cancel-factura" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Anular Factura</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="modal-context">
          <span>
            Factura: <strong>#{factura.num_factura}</strong>
          </span>
          <span>
            Cliente: <strong>{factura.cliente}</strong>
          </span>
        </div>
        <form onSubmit={onSubmit}>
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
          <div className="modal-buttons">
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelFacturaModal;
