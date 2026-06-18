import { getSerieDisplay, getTipoLabel, isStockTipo } from '../utils/inventarioHelpers';

const BajaArticuloModal = ({
  bajaForm,
  bajaTarget,
  isSavingBaja,
  onCancel,
  onConfirm,
  onFormChange,
}) => {
  if (!bajaTarget) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-baja" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Dar de baja artículo</h3>
          <button className="modal-close" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <div className="modal-body">
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
              value={bajaForm.motivo}
              onChange={(e) => onFormChange((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Describe por qué se da de baja este artículo"
              required
            />
          </div>
        </div>
        <div className="modal-buttons">
          <button
            className="btn btn-modal-clear"
            onClick={onCancel}
            disabled={isSavingBaja}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isSavingBaja}
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
        </div>
      </div>
    </div>
  );
};

export default BajaArticuloModal;
