import { fullName, TIPOS_USUARIO } from '../utils/usuariosHelpers';

const UsuarioEditModal = ({
  editData,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  selectedUsuario,
}) => (
  <div className="modal-overlay">
    <div className="modal usuarios-modal usuarios-modal--sm">
      <div className="modal-header">
        <h3>
          Editar — <em>{fullName(selectedUsuario)}</em>
        </h3>
        <button className="modal-close" onClick={onCancel} aria-label="Cerrar" type="button">
          ×
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body usuarios-form-grid">
          <div className="form-group">
            <label htmlFor="e-nombre">Nombre</label>
            <input
              id="e-nombre"
              value={editData.nombre}
              onChange={(e) => onChange('nombre', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label htmlFor="e-apellido">Apellido</label>
            <input
              id="e-apellido"
              value={editData.apellido}
              onChange={(e) => onChange('apellido', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label htmlFor="e-tipo">Tipo de usuario</label>
            <select
              id="e-tipo"
              value={editData.tipo_usuario}
              onChange={(e) => onChange('tipo_usuario', e.target.value)}
            >
              {TIPOS_USUARIO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="e-estado">Estado</label>
            <select
              id="e-estado"
              value={editData.activo ? 'true' : 'false'}
              onChange={(e) => onChange('activo', e.target.value === 'true')}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="modal-buttons usuarios-modal-actions">
          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="spinner spinner--sm" />
                Guardando…
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
          <button
            className="btn btn-modal-clear"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default UsuarioEditModal;
