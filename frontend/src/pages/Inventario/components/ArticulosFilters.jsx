import { INVENTARIO_ESTADOS, INVENTARIO_TIPOS } from '../utils/inventarioHelpers';

const ArticulosFilters = ({ filters, ubicaciones, onApply, onChange, onClear }) => (
  <div className="ff-filter-row inventario-articulos-filter-row">
    <div className="ff-filter-card inventario-articulos-filter-card">
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
            onChange={onChange}
            placeholder="Nombre, serie, marca o modelo..."
            onKeyDown={(e) => e.key === 'Enter' && onApply()}
          />
        </div>
        <div className="ff-state">
          <span className="ff-state-label">Tipo</span>
          <select name="tipo" value={filters.tipo} onChange={onChange}>
            {INVENTARIO_TIPOS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ff-state">
          <span className="ff-state-label">Ubicación</span>
          <select name="ubicacion_id" value={filters.ubicacion_id} onChange={onChange}>
            <option value="">Todas</option>
            {ubicaciones.map((ub) => (
              <option key={ub.id} value={ub.id}>
                {ub.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="ff-state">
          <span className="ff-state-label">Estado</span>
          <select name="estado" value={filters.estado} onChange={onChange}>
            {INVENTARIO_ESTADOS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>

    <div className="ff-filter-actions-card inventario-articulos-filter-actions-card">
      <div className="ff-actions">
        <button className="btn btn-primary btn-sm" onClick={onApply} type="button">
          Aplicar
        </button>
        <button className="ff-clear-btn" onClick={onClear} type="button">
          Limpiar
        </button>
      </div>
    </div>
  </div>
);

export default ArticulosFilters;
