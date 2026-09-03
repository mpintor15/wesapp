import AppModal from '../../../components/AppModal';
import { validateMotivoAdministrativo } from '../utils/inventarioHelpers';

const InventoryReasonModal = ({
  action,
  isSubmitting,
  motivo,
  onCancel,
  onConfirm,
  onMotivoChange,
}) => {
  if (!action) return null;

  const error = validateMotivoAdministrativo(motivo);
  const motivoLength = motivo.length;
  const descriptionId = 'inventory-reason-description';
  const motivoId = 'inventory-reason-motivo';

  return (
    <AppModal
      isOpen
      onClose={onCancel}
      title={action.title}
      size="md"
      variant="alertdialog"
      ariaDescribedby={descriptionId}
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      closeButtonDisabled={isSubmitting}
      className="inventory-reason-modal"
    >
      <AppModal.Header />
      <AppModal.Body id={descriptionId}>
        <div className="reason-summary">
          <span>{action.entityLabel}</span>
          <strong>{action.entityName}</strong>
        </div>
        <div className="reason-copy">
          {action.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
        <div className="form-group">
          <label htmlFor={motivoId}>Motivo</label>
          <textarea
            id={motivoId}
            rows="4"
            maxLength="500"
            value={motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            aria-describedby="inventory-reason-help"
            aria-invalid={Boolean(error)}
            disabled={isSubmitting}
            placeholder={action.placeholder || 'Describe el motivo de esta acción'}
          />
          <div id="inventory-reason-help" className="reason-field-help">
            <span>{error || 'Motivo válido.'}</span>
            <span>{motivoLength}/500</span>
          </div>
        </div>
      </AppModal.Body>
      <AppModal.Footer className="inventory-modal-actions">
        <button
          className="btn btn-neutral"
          onClick={onCancel}
          disabled={isSubmitting}
          type="button"
        >
          Cancelar
        </button>
        <button
          className={action.confirmClassName || 'btn btn-destructive'}
          onClick={onConfirm}
          disabled={isSubmitting || Boolean(error)}
          type="button"
        >
          {isSubmitting ? (
            <>
              <span className="spinner spinner--sm" />
              Procesando…
            </>
          ) : (
            action.confirmText
          )}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default InventoryReasonModal;
