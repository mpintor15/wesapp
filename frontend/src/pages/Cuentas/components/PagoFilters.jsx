const PagoFilters = ({ filters, onFilterChange, onApply, onClear, onToggle }) => (
  <div className="ff-filter-row pagos-filter-row">
    <div className="ff-filter-card pagos-filter-card">
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
            value={filters.search}
            onChange={onFilterChange}
            onKeyDown={(e) => e.key === 'Enter' && onApply()}
            placeholder="Cliente o valor..."
          />
        </div>
        <div className="ff-dates">
          <div className="ff-date-field">
            <span className="ff-date-label">Desde</span>
            <input
              type="date"
              name="fechaInicio"
              value={filters.fechaInicio}
              onChange={onFilterChange}
            />
          </div>
          <div className="ff-date-field">
            <span className="ff-date-label">Hasta</span>
            <input type="date" name="fechaFin" value={filters.fechaFin} onChange={onFilterChange} />
          </div>
        </div>
        <div className="ff-state">
          <span className="ff-state-label">Método</span>
          <select name="metodoPago" value={filters.metodoPago} onChange={onFilterChange}>
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="cheque">Cheque</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="ff-pills">
          <button
            type="button"
            className={`ff-pill${filters.agruparCliente ? ' active' : ''}`}
            onClick={() => onToggle('agruparCliente')}
          >
            Agrupar por cliente
          </button>
        </div>
      </div>
    </div>
    <div className="ff-filter-actions-card pagos-filter-actions-card">
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

export default PagoFilters;
