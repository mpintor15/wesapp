import AppModal from '../../../components/AppModal';
import GroupedMultiSelect from '../../../components/GroupedMultiSelect';
import SearchableSelect from '../../../components/SearchableSelect';
import {
  fullName,
  getColaboradorLabel,
  getColaboradorSearchText,
  getUbicacionLabel,
  getUbicacionSearchText,
  TIPOS_USUARIO,
} from '../utils/usuariosHelpers';

const UsuarioEditModal = ({
  canManageAssignments,
  colaboradores,
  colaboradoresError,
  colaboradoresLoading,
  editData,
  isSaving,
  lockColaborador = false,
  onReenviarInvitacion,
  onRevoke,
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
    size="md"
    className="usuarios-modal"
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
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="e-apellido">Apellido</label>
          <input
            id="e-apellido"
            value={editData.apellido}
            onChange={(e) => onChange('apellido', e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="form-group usuarios-form-grid__full">
          <label htmlFor="e-colaborador">
            Colaborador <span className="required">*</span>
          </label>
          <SearchableSelect
            inputId="e-colaborador"
            value={editData.colaborador_id}
            options={colaboradores}
            onChange={(value) => onChange('colaborador_id', value)}
            getOptionLabel={getColaboradorLabel}
            getOptionSearchText={getColaboradorSearchText}
            placeholder="Buscar por nombre, apellido o cédula"
            loading={colaboradoresLoading}
            emptyMessage="No hay colaboradores elegibles."
            disabled={lockColaborador}
          />
          {colaboradoresError ? (
            <span id="e-colaborador-error" className="field-error" role="alert">
              {colaboradoresError}
            </span>
          ) : null}
        </div>
        <div className="form-group">
          <label htmlFor="e-tipo">Tipo de usuario</label>
          <select
            id="e-tipo"
            value={editData.tipo_usuario}
            onChange={(e) => onChange('tipo_usuario', e.target.value)}
            required
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
        {editData.tipo_usuario === 'guardia' && canManageAssignments ? (
          <fieldset className="form-group usuarios-form-grid__full usuarios-puntos">
            <legend>Puntos asignados</legend>
            {ubicacionesError ? (
              <span className="field-error" role="alert">
                {ubicacionesError}
              </span>
            ) : null}
            <GroupedMultiSelect
              inputId="e-puntos"
              options={ubicaciones}
              value={editData.ubicacion_ids}
              onChange={(value) => onChange('ubicacion_ids', value)}
              getGroupLabel={(ubicacion) => ubicacion.cliente_nombre || 'Sin cliente'}
              getOptionLabel={getUbicacionLabel}
              getOptionSearchText={getUbicacionSearchText}
              placeholder="Buscar por cliente, punto o dirección"
              loading={ubicacionesLoading}
              emptyMessage="No hay ubicaciones disponibles."
            />
          </fieldset>
        ) : null}
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
        {onReenviarInvitacion ? (
          <button
            className="btn btn-neutral"
            type="button"
            onClick={onReenviarInvitacion}
            disabled={isSaving}
          >
            Reenviar invitación
          </button>
        ) : null}
        {onRevoke ? (
          <button
            className="btn btn-destructive"
            type="button"
            onClick={onRevoke}
            disabled={isSaving}
          >
            Revocar acceso
          </button>
        ) : null}
      </AppModal.Footer>
    </form>
  </AppModal>
);

export default UsuarioEditModal;
