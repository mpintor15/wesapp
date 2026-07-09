import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';
import FacturaTaxOptions from './FacturaTaxOptions';

const EditFacturaModal = ({
  isOpen,
  factura,
  formData,
  errors,
  isGerente,
  isSubmitting,
  onFormChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen || !factura) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      title={`Editar Factura #${factura.num_factura}`}
      size="lg"
      className="modal-factura"
    >
      <form onSubmit={onSubmit}>
        <AppModal.Header />
        <AppModal.Body>
          <div className="modal-form-grid">
            <div className="form-group cliente-search-group">
              <label>Cliente</label>
              <input
                type="text"
                value={factura.cliente || ''}
                readOnly
                className="input-readonly"
                title="El cliente no se puede modificar desde la edición de factura"
              />
              {errors.cliente_id ? <span className="field-error">{errors.cliente_id}</span> : null}
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <FilterDateInput
                name="fecha_factura"
                value={formData.fecha_factura}
                onChange={onFormChange}
                disabled={!isGerente}
              />
            </div>
            <div className="form-group">
              <label>Subtotal</label>
              <div className="money-input-wrapper">
                <span className="money-input-prefix">$</span>
                <input
                  type="number"
                  name="valor_factura"
                  step="0.01"
                  value={formData.valor_factura}
                  onChange={onFormChange}
                  placeholder="0.00"
                  disabled={!isGerente}
                />
              </div>
            </div>
          </div>

          <FacturaTaxOptions
            values={formData}
            onChange={onFormChange}
            style={{ margin: '1rem 0' }}
          />
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner spinner--sm" />
                Guardando…
              </>
            ) : (
              'Guardar cambios'
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

export default EditFacturaModal;
