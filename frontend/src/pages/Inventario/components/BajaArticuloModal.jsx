import AppModal from '../../../components/AppModal';
import {
  getSerieDisplay,
  getTipoLabel,
  isStockTipo,
  validateMotivoAdministrativo,
} from '../utils/inventarioHelpers';

const BajaArticuloModal = ({
  bajaForm,
  bajaTarget,
  isSavingBaja,
  onCancel,
  onConfirm,
  onFormChange,
}) => {
  if (!bajaTarget) return null;
  const motivoError = validateMotivoAdministrativo(bajaForm.motivo);

  return (
    <AppModal
      isOpen
      onClose={onCancel}
      title="Dar de baja artículo"
      size="md"
      closeOnBackdrop={!isSavingBaja}
      closeOnEscape={!isSavingBaja}
      closeButtonDisabled={isSavingBaja}
      className="inventory-baja-modal"
    >
      <AppModal.Header />
      <AppModal.Body>
        <div className="baja-summary">
          <div>
            <span>Artículo</span>
            <strong>
              {bajaTarget.nombre_articulo || getSerieDisplay(bajaTarget) || bajaTarget.id}
            </strong>
          </div>
          <div>
            <span>Tipo</span>
            <strong>{getTipoLabel(bajaTarget.tipo_articulo)}</strong>
          </div>
          <div>
            <span>Serie</span>
            <strong>{getSerieDisplay(bajaTarget)}</strong>
          </div>
          <div>
            <span>Ubicación</span>
            <strong>{bajaTarget.ubicacion_nombre || '-'}</strong>
          </div>
        </div>
        {isStockTipo(bajaTarget.tipo_articulo) ? (
          <div className="form-group">
            <label htmlFor="baja-cantidad">Cantidad a dar de baja</label>
            <input
              id="baja-cantidad"
              type="number"
              min="1"
              max={bajaTarget.cantidad}
              value={bajaForm.cantidad}
              onChange={(e) => onFormChange((prev) => ({ ...prev, cantidad: e.target.value }))}
              disabled={isSavingBaja}
            />
            <p className="delete-hint">Disponible: {bajaTarget.cantidad} unidades</p>
          </div>
        ) : (
          <div className="baja-notice">Este artículo se dará de baja por completo.</div>
        )}
        <div className="form-group">
          <label htmlFor="baja-motivo">Motivo de la baja</label>
          <textarea
            id="baja-motivo"
            rows="4"
            maxLength="500"
            value={bajaForm.motivo}
            onChange={(e) => onFormChange((prev) => ({ ...prev, motivo: e.target.value }))}
            placeholder="Describe por qué se da de baja este artículo"
            aria-describedby="baja-motivo-help"
            aria-invalid={Boolean(motivoError)}
            required
            disabled={isSavingBaja}
          />
          <div id="baja-motivo-help" className="reason-field-help">
            <span>{motivoError || 'Motivo válido.'}</span>
            <span>{bajaForm.motivo.length}/500</span>
          </div>
        </div>
      </AppModal.Body>
      <AppModal.Footer className="inventory-modal-actions">
        <button
          className="btn btn-neutral"
          onClick={onCancel}
          disabled={isSavingBaja}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="btn btn-destructive"
          onClick={onConfirm}
          disabled={isSavingBaja || Boolean(motivoError)}
          type="button"
        >
          {isSavingBaja ? (
            <>
              <span className="spinner spinner--sm" />
              Guardando…
            </>
          ) : (
            'Dar de baja'
          )}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default BajaArticuloModal;
