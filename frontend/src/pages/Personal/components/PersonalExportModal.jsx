const PersonalExportModal = ({
  cargos,
  exportFilters,
  isExporting,
  onCancel,
  onExport,
  onFilterChange,
}) => (
  <div className="modal-overlay">
    <div className="modal personal-modal personal-report-modal">
      <div className="modal-header">
        <h3>Generar reporte de Personal</h3>
        <button className="modal-close" onClick={onCancel} aria-label="Cerrar" type="button">
          ×
        </button>
      </div>
      <div className="modal-body">
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
        </div>
      </div>
      <div className="modal-buttons personal-modal-actions">
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
      </div>
    </div>
  </div>
);

export default PersonalExportModal;
