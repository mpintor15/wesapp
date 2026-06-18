import { TIPOS_USUARIO } from '../utils/usuariosHelpers';

const UsuariosFilters = ({ filtersDraft, onApply, onChange, onClear }) => (
  <div className="ff-filter-row usuarios-filter-row">
    <div className="ff-filter-card usuarios-filter-card">
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
            placeholder="Nombre, apellido o usuario..."
          />
        </div>
        <div className="ff-state">
          <span className="ff-state-label">Tipo</span>
          <select name="tipo_usuario" value={filtersDraft.tipo_usuario} onChange={onChange}>
            <option value="">Todos</option>
            {TIPOS_USUARIO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ff-state">
          <span className="ff-state-label">Estado</span>
          <select name="activo" value={filtersDraft.activo} onChange={onChange}>
            <option value="">Todos</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
      </div>
    </div>
    <div className="ff-filter-actions-card usuarios-filter-actions-card">
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

export default UsuariosFilters;
