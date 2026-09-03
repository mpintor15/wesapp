import AppModal from '../../../components/AppModal';

const MAX_NOMBRE_LENGTH = 100;

const UbicacionQuickCreateModal = ({
  error,
  form,
  isOpen,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}) => {
  const trimmedName = form.nombre.trim();
  const isNameTooLong = trimmedName.length > MAX_NOMBRE_LENGTH;
  const isInvalid = !trimmedName || isNameTooLong || isSubmitting;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva ubicación"
      size="sm"
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      className="inventory-location-modal"
    >
      <form onSubmit={onSubmit}>
        <AppModal.Header />
        <AppModal.Body>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="quick-ubicacion-nombre">Nombre</label>
            <input
              id="quick-ubicacion-nombre"
              type="text"
              value={form.nombre}
              maxLength={MAX_NOMBRE_LENGTH + 1}
              onChange={(event) => onChange({ nombre: event.target.value })}
              placeholder="Ej: Bodega principal"
              disabled={isSubmitting}
              autoFocus
            />
            <div className="inventory-location-field-meta">
              <span>
                {isNameTooLong
                  ? `Máximo ${MAX_NOMBRE_LENGTH} caracteres.`
                  : 'Se creará como parte del artículo.'}
              </span>
              <span>{trimmedName.length}/100</span>
            </div>
          </div>
        </AppModal.Body>
        <AppModal.Footer className="inventory-modal-actions">
          <button className="btn btn-primary" type="submit" disabled={isInvalid}>
            {isSubmitting ? 'Creando...' : 'Crear ubicación'}
          </button>
          <button
            className="btn btn-neutral"
            type="button"
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

export default UbicacionQuickCreateModal;
