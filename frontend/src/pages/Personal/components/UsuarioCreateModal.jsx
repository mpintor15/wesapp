import AppModal from '../../../components/AppModal';
import GroupedMultiSelect from '../../../components/GroupedMultiSelect';
import SearchableSelect from '../../../components/SearchableSelect';
import {
  getColaboradorLabel,
  getColaboradorSearchText,
  getUbicacionLabel,
  getUbicacionSearchText,
  getUsuarioSinColaboradorLabel,
  getUsuarioSinColaboradorSearchText,
  TIPOS_USUARIO,
} from '../utils/usuariosHelpers';

const UsuarioCreateModal = ({
  canManageAssignments,
  colaboradores,
  colaboradoresError,
  colaboradoresLoading,
  createErrors,
  formData,
  isCreating,
  lockColaborador = false,
  linkErrors = {},
  linkUsuarioId = '',
  mode = 'crear',
  showLinkOption = false,
  ubicaciones,
  ubicacionesError,
  ubicacionesLoading,
  usuariosSinColaborador = [],
  usuariosSinColaboradorError = '',
  usuariosSinColaboradorLoading = false,
  onCancel,
  onChange,
  onLinkUsuarioChange,
  onModeChange,
  onSubmit,
}) => {
  const isLinkMode = mode === 'vincular';

  return (
    <AppModal
      isOpen
      onClose={onCancel}
      title={isLinkMode ? 'Vincular usuario existente' : 'Crear nuevo usuario'}
      size="md"
      className="usuarios-modal"
    >
      <AppModal.Header />
      <form onSubmit={onSubmit}>
        <AppModal.Body className="usuarios-form-grid">
          {showLinkOption ? (
            <div
              className="usuarios-mode-toggle form-group usuarios-form-grid__full"
              role="group"
              aria-label="Tipo de acceso a crear"
            >
              <button
                className={`btn btn-sm ${!isLinkMode ? 'btn-primary' : 'btn-secondary'}`}
                type="button"
                onClick={() => onModeChange('crear')}
                aria-pressed={!isLinkMode}
                disabled={isCreating}
              >
                Crear nuevo usuario
              </button>
              <button
                className={`btn btn-sm ${isLinkMode ? 'btn-primary' : 'btn-secondary'}`}
                type="button"
                onClick={() => onModeChange('vincular')}
                aria-pressed={isLinkMode}
                disabled={isCreating}
              >
                Vincular usuario existente
              </button>
            </div>
          ) : null}
          {isLinkMode ? (
            <div className="form-group usuarios-form-grid__full">
              <label htmlFor="u-link-usuario">
                Usuario existente <span className="required">*</span>
              </label>
              <SearchableSelect
                inputId="u-link-usuario"
                value={linkUsuarioId}
                options={usuariosSinColaborador}
                onChange={onLinkUsuarioChange}
                getOptionLabel={getUsuarioSinColaboradorLabel}
                getOptionSearchText={getUsuarioSinColaboradorSearchText}
                placeholder="Buscar por usuario, nombre o apellido"
                loading={usuariosSinColaboradorLoading}
                emptyMessage="No hay usuarios sin colaborador vinculado."
              />
              <div className="configuracion-field-meta">
                <span>Solo usuarios que aún no tienen colaborador asociado.</span>
              </div>
              {linkErrors.usuario_id ? (
                <span className="field-error">{linkErrors.usuario_id}</span>
              ) : null}
              {usuariosSinColaboradorError ? (
                <span className="field-error" role="alert">
                  {usuariosSinColaboradorError}
                </span>
              ) : null}
            </div>
          ) : (
            <>
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
                {createErrors.nombre ? (
                  <span className="field-error">{createErrors.nombre}</span>
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
              <div className="form-group usuarios-form-grid__full">
                <label htmlFor="u-colaborador">
                  Colaborador <span className="required">*</span>
                </label>
                <SearchableSelect
                  inputId="u-colaborador"
                  value={formData.colaborador_id}
                  options={colaboradores}
                  onChange={(value) => onChange('colaborador_id', value)}
                  getOptionLabel={getColaboradorLabel}
                  getOptionSearchText={getColaboradorSearchText}
                  placeholder="Buscar por nombre, apellido o cédula"
                  loading={colaboradoresLoading}
                  emptyMessage="No hay colaboradores elegibles."
                  disabled={lockColaborador}
                />
                {createErrors.colaborador_id ? (
                  <span className="field-error">{createErrors.colaborador_id}</span>
                ) : null}
                {colaboradoresError ? (
                  <span id="u-colaborador-error" className="field-error" role="alert">
                    {colaboradoresError}
                  </span>
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
                <label htmlFor="u-tipo">
                  Tipo de usuario <span className="required">*</span>
                </label>
                <select
                  id="u-tipo"
                  value={formData.tipo_usuario}
                  onChange={(e) => onChange('tipo_usuario', e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Seleccionar tipo de usuario
                  </option>
                  {TIPOS_USUARIO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
                {createErrors.tipo_usuario ? (
                  <span className="field-error">{createErrors.tipo_usuario}</span>
                ) : null}
              </div>
              {formData.tipo_usuario === 'guardia' && canManageAssignments ? (
                <fieldset className="form-group usuarios-form-grid__full usuarios-puntos">
                  <legend>Puntos asignados</legend>
                  {ubicacionesError ? (
                    <span className="field-error" role="alert">
                      {ubicacionesError}
                    </span>
                  ) : null}
                  <GroupedMultiSelect
                    inputId="u-puntos"
                    options={ubicaciones}
                    value={formData.ubicacion_ids}
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
            </>
          )}
        </AppModal.Body>
        <AppModal.Footer className="usuarios-modal-actions">
          <button className="btn btn-primary" type="submit" disabled={isCreating}>
            {isCreating ? (
              <>
                <span className="spinner spinner--sm" />
                {isLinkMode ? 'Vinculando…' : 'Creando…'}
              </>
            ) : isLinkMode ? (
              'Vincular usuario'
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
};

export default UsuarioCreateModal;
