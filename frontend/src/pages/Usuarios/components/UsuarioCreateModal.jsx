import AppModal from '../../../components/AppModal';
import { TIPOS_USUARIO } from '../utils/usuariosHelpers';

const UsuarioCreateModal = ({
  createErrors,
  formData,
  isCreating,
  onCancel,
  onChange,
  onSubmit,
}) => (
  <AppModal
    isOpen
    onClose={onCancel}
    title="Crear nuevo usuario"
    size="md"
    className="usuarios-modal"
  >
    <AppModal.Header />
    <form onSubmit={onSubmit}>
      <AppModal.Body className="usuarios-form-grid">
        <div className="form-group">
          <label htmlFor="u-nombre">
            Nombre <span className="required">*</span>
          </label>
          <input
            id="u-nombre"
            value={formData.nombre}
            onChange={(e) => onChange('nombre', e.target.value)}
            autoComplete="off"
            required
          />
          {createErrors.nombre ? <span className="field-error">{createErrors.nombre}</span> : null}
        </div>
        <div className="form-group">
          <label htmlFor="u-apellido">
            Apellido <span className="required">*</span>
          </label>
          <input
            id="u-apellido"
            value={formData.apellido}
            onChange={(e) => onChange('apellido', e.target.value)}
            autoComplete="off"
            required
          />
          {createErrors.apellido ? (
            <span className="field-error">{createErrors.apellido}</span>
          ) : null}
        </div>
        <div className="form-group">
          <label htmlFor="u-usuario">
            Usuario <span className="required">*</span>
          </label>
          <input
            id="u-usuario"
            value={formData.usuario}
            onChange={(e) => onChange('usuario', e.target.value)}
            autoComplete="off"
            required
          />
          {createErrors.usuario ? (
            <span className="field-error">{createErrors.usuario}</span>
          ) : null}
        </div>
        <div className="form-group">
          <label htmlFor="u-tipo">Tipo de usuario</label>
          <select
            id="u-tipo"
            value={formData.tipo_usuario}
            onChange={(e) => onChange('tipo_usuario', e.target.value)}
          >
            {TIPOS_USUARIO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>
      </AppModal.Body>
      <AppModal.Footer className="usuarios-modal-actions">
        <button className="btn btn-primary" type="submit" disabled={isCreating}>
          {isCreating ? (
            <>
              <span className="spinner spinner--sm" />
              Creando…
            </>
          ) : (
            'Crear usuario'
          )}
        </button>
        <button
          className="btn btn-modal-clear"
          type="button"
          onClick={onCancel}
          disabled={isCreating}
        >
          Cancelar
        </button>
      </AppModal.Footer>
    </form>
  </AppModal>
);

export default UsuarioCreateModal;
