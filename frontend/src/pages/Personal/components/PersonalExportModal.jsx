import AppModal from '../../../components/AppModal';

const PersonalExportModal = ({
  cargos,
  exportFilters,
  isExporting,
  onCancel,
  onExport,
  onFilterChange,
}) => (
  <AppModal
    isOpen
    onClose={onCancel}
    title="Generar reporte de Personal"
    size="sm"
    className="personal-modal personal-report-modal"
  >
    <AppModal.Header />
    <AppModal.Body>
      <div className="report-form-grid">
        <div className="form-group">
          <label htmlFor="exp-estado">Estado</label>
          <select
            id="exp-estado"
            value={exportFilters.estado}
            onChange={(e) => onFilterChange((prev) => ({ ...prev, estado: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="exp-cargo">Cargo</label>
          <select
            id="exp-cargo"
            value={exportFilters.cargo}
            onChange={(e) => onFilterChange((prev) => ({ ...prev, cargo: e.target.value }))}
          >
            <option value="">Todos</option>
            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="exp-credenciales">Credenciales</label>
          <select
            id="exp-credenciales"
            value={exportFilters.tiene_usuario}
            onChange={(e) => onFilterChange((prev) => ({ ...prev, tiene_usuario: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="true">Con credenciales</option>
            <option value="false">Sin credenciales</option>
          </select>
        </div>
      </div>
    </AppModal.Body>
    <AppModal.Footer className="personal-modal-actions">
      <button className="btn btn-primary" onClick={onExport} disabled={isExporting} type="button">
        {isExporting ? (
          <>
            <span className="spinner spinner--sm" />
            Generando…
          </>
        ) : (
          'Exportar reporte'
        )}
      </button>
      <button
        className="btn btn-modal-clear"
        onClick={onCancel}
        disabled={isExporting}
        type="button"
      >
        Cancelar
      </button>
    </AppModal.Footer>
  </AppModal>
);

export default PersonalExportModal;
