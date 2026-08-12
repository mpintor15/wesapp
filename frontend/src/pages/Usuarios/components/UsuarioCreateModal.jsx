import AppModal from '../../../components/AppModal';
import { TIPOS_USUARIO } from '../utils/usuariosHelpers';

const UsuarioCreateModal = ({
  canManageAssignments,
  colaboradores,
  colaboradoresError,
  colaboradoresLoading,
  createErrors,
  formData,
  isCreating,
  ubicaciones,
  ubicacionesError,
  ubicacionesLoading,
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
        {formData.tipo_usuario === 'guardia' && canManageAssignments ? (
          <fieldset className="form-group usuarios-form-grid__full usuarios-puntos">
            <legend>Puntos asignados</legend>
            {ubicacionesLoading ? <span>Cargando ubicaciones…</span> : null}
            {ubicacionesError ? (
              <span className="field-error" role="alert">
                {ubicacionesError}
              </span>
            ) : null}
            {!ubicacionesLoading && !ubicacionesError && ubicaciones.length === 0 ? (
              <span>No hay ubicaciones disponibles.</span>
            ) : null}
            {ubicaciones.map((ubicacion) => (
              <label key={ubicacion.id}>
                <input
                  type="checkbox"
                  checked={formData.ubicacion_ids.includes(String(ubicacion.id))}
                  onChange={(event) =>
                    onChange(
                      'ubicacion_ids',
                      event.target.checked
                        ? [...formData.ubicacion_ids, String(ubicacion.id)]
                        : formData.ubicacion_ids.filter((id) => id !== String(ubicacion.id))
                    )
                  }
                />
                {ubicacion.nombre}
                {ubicacion.cliente_nombre ? ` — ${ubicacion.cliente_nombre}` : ''}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="form-group usuarios-form-grid__full">
          <label htmlFor="u-colaborador">Colaborador</label>
          <select
            id="u-colaborador"
            value={formData.colaborador_id}
            onChange={(e) => onChange('colaborador_id', e.target.value)}
            disabled={colaboradoresLoading}
            aria-describedby={colaboradoresError ? 'u-colaborador-error' : undefined}
          >
            <option value="">
              {colaboradoresLoading ? 'Cargando colaboradores…' : 'Sin colaborador'}
            </option>
            {colaboradores.map((colaborador) => (
              <option key={colaborador.id} value={colaborador.id}>
                {colaborador.nombres_completos} — {colaborador.cedula}
              </option>
            ))}
          </select>
          {colaboradoresError ? (
            <span id="u-colaborador-error" className="field-error" role="alert">
              {colaboradoresError}
            </span>
          ) : null}
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
