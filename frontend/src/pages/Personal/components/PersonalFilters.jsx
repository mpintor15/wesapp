const PersonalFilters = ({ cargos, filtersDraft, onApply, onChange, onClear }) => (
  <div className="ff-filter-row personal-filter-row">
    <div className="ff-filter-card personal-filter-card">
      <div className="ff-controls">
        <div className="ff-search">
          <svg
            className="ff-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            name="search"
            value={filtersDraft.search}
            onChange={onChange}
            onKeyDown={(e) => e.key === 'Enter' && onApply()}
            placeholder="Nombre, cédula, celular o cuenta..."
          />
        </div>

        <div className="ff-state">
          <span className="ff-state-label">Estado</span>
          <select name="estado" value={filtersDraft.estado} onChange={onChange}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div className="ff-state">
          <span className="ff-state-label">Cargo</span>
          <select name="cargo" value={filtersDraft.cargo} onChange={onChange}>
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
    <div className="ff-filter-actions-card personal-filter-actions-card">
      <div className="ff-actions">
        <button className="btn btn-primary btn-sm" type="button" onClick={onApply}>
          Aplicar
        </button>
        <button className="ff-clear-btn" type="button" onClick={onClear}>
          Limpiar
        </button>
      </div>
    </div>
  </div>
);

export default PersonalFilters;
