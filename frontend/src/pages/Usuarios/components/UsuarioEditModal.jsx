import AppModal from '../../../components/AppModal';
import { fullName, TIPOS_USUARIO } from '../utils/usuariosHelpers';

const UsuarioEditModal = ({
  canManageAssignments,
  colaboradores,
  colaboradoresError,
  colaboradoresLoading,
  editData,
  isSaving,
  ubicaciones,
  ubicacionesError,
  ubicacionesLoading,
  onCancel,
  onChange,
  onSubmit,
  selectedUsuario,
}) => (
  <AppModal
    isOpen
    onClose={onCancel}
    title={`Editar ${fullName(selectedUsuario)}`}
    size="sm"
    className="usuarios-modal usuarios-modal--sm"
  >
    <AppModal.Header>
      <>
        Editar — <em>{fullName(selectedUsuario)}</em>
      </>
    </AppModal.Header>
    <form onSubmit={onSubmit}>
      <AppModal.Body className="usuarios-form-grid">
        <div className="form-group">
          <label htmlFor="e-nombre">Nombre</label>
          <input
            id="e-nombre"
            value={editData.nombre}
            onChange={(e) => onChange('nombre', e.target.value)}
            autoComplete="off"
          />
        </div>
        {editData.tipo_usuario === 'guardia' && canManageAssignments ? (
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
                  checked={editData.ubicacion_ids.includes(String(ubicacion.id))}
                  onChange={(event) =>
                    onChange(
                      'ubicacion_ids',
                      event.target.checked
                        ? [...editData.ubicacion_ids, String(ubicacion.id)]
                        : editData.ubicacion_ids.filter((id) => id !== String(ubicacion.id))
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
          <label htmlFor="e-colaborador">Colaborador</label>
          <select
            id="e-colaborador"
            value={editData.colaborador_id}
            onChange={(e) => onChange('colaborador_id', e.target.value)}
            disabled={colaboradoresLoading}
            aria-describedby={colaboradoresError ? 'e-colaborador-error' : undefined}
          >
            <option value="">
              {colaboradoresLoading ? 'Cargando colaboradores…' : 'Sin colaborador'}
            </option>
            {colaboradores.map((colaborador) => (
              <option key={colaborador.id} value={colaborador.id}>
                {colaborador.nombres_completos} — {colaborador.cedula}
                {colaborador.estado === 'inactivo' ? ' (Inactivo)' : ''}
              </option>
            ))}
          </select>
          {colaboradoresError ? (
            <span id="e-colaborador-error" className="field-error" role="alert">
              {colaboradoresError}
            </span>
          ) : null}
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
      </AppModal.Body>
      <AppModal.Footer className="usuarios-modal-actions">
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
      </AppModal.Footer>
    </form>
  </AppModal>
);

export default UsuarioEditModal;
