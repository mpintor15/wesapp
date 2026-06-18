const PersonalFormModal = ({
  editingColaborador,
  formData,
  formErrors,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}) => {
  const saveLabel = editingColaborador ? 'Guardar cambios' : 'Crear colaborador';
  const savingLabel = editingColaborador ? 'Guardando…' : 'Creando…';

  return (
    <div className="modal-overlay">
      <div className="modal personal-modal">
        <div className="modal-header">
          <h3>{editingColaborador ? 'Editar colaborador' : 'Nuevo colaborador'}</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Cerrar" type="button">
            ×
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body personal-form-grid">
            <div className="form-group">
              <label htmlFor="p-nombres">
                Nombre completo <span className="required">*</span>
              </label>
              <input
                id="p-nombres"
                name="nombres_completos"
                value={formData.nombres_completos}
                onChange={onChange}
                required
              />
              {formErrors.nombres_completos ? (
                <span className="field-error">{formErrors.nombres_completos}</span>
              ) : null}
            </div>
            <div className="form-group">
              <label htmlFor="p-cedula">
                Cédula <span className="required">*</span>
              </label>
              <input
                id="p-cedula"
                name="cedula"
                value={formData.cedula}
                onChange={onChange}
                required
                disabled={!!editingColaborador}
              />
              {formErrors.cedula ? <span className="field-error">{formErrors.cedula}</span> : null}
            </div>
            <div className="form-group">
              <label htmlFor="p-fnac">
                Fecha de nacimiento <span className="required">*</span>
              </label>
              <input
                id="p-fnac"
                type="date"
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={onChange}
                required
                disabled={!!editingColaborador}
              />
              {formErrors.fecha_nacimiento ? (
                <span className="field-error">{formErrors.fecha_nacimiento}</span>
              ) : null}
            </div>
            <div className="form-group">
              <label htmlFor="p-cargo">
                Cargo <span className="required">*</span>
              </label>
              <input
                id="p-cargo"
                name="cargo"
                value={formData.cargo}
                onChange={onChange}
                required
              />
              {formErrors.cargo ? <span className="field-error">{formErrors.cargo}</span> : null}
            </div>
            <div className="form-group">
              <label htmlFor="p-celular">Celular</label>
              <input id="p-celular" name="celular" value={formData.celular} onChange={onChange} />
            </div>
            <div className="form-group">
              <label htmlFor="p-banco">Banco</label>
              <input id="p-banco" name="banco" value={formData.banco} onChange={onChange} />
            </div>
            <div className="form-group">
              <label htmlFor="p-cuenta">Número de cuenta</label>
              <input
                id="p-cuenta"
                name="numero_cuenta"
                value={formData.numero_cuenta}
                onChange={onChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="p-sueldo">Sueldo</label>
              <div className="money-input-wrapper">
                <span className="money-input-prefix">$</span>
                <input
                  id="p-sueldo"
                  type="number"
                  step="0.01"
                  name="sueldo"
                  value={formData.sueldo}
                  onChange={onChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="p-estado">Estado</label>
              <select id="p-estado" name="estado" value={formData.estado} onChange={onChange}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="modal-buttons personal-modal-actions">
            <button className="btn btn-primary" type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <span className="spinner spinner--sm" />
                  {savingLabel}
                </>
              ) : (
                saveLabel
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
};

export default PersonalFormModal;
