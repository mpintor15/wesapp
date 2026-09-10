import { formatDate, getSerieDisplay, getTipoLabel } from '../utils/inventarioHelpers';
import CollapsibleFilters from '../../../components/CollapsibleFilters';
import FilterDateInput from '../../../components/FilterDateInput';
import LoadingState from '../../../components/LoadingState';
import PaginationControls from '../../../components/PaginationControls';

const BajasTab = ({
  bajas,
  bajasPage,
  bajasTotalItems,
  bajasTotalPages,
  bajasFiltersDraft,
  bajasLoading,
  onApplyFilters,
  onClearFilters,
  onDraftChange,
  onPageChange,
}) => (
  <div className="tab-content">
    <CollapsibleFilters>
      <div className="ff-filter-row inventario-bajas-filter-row">
        <div className="ff-filter-card inventario-bajas-filter-card">
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
                value={bajasFiltersDraft.search}
                onChange={onDraftChange}
                onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
                placeholder="Buscar artículo, serie, motivo, ubicación o usuario..."
              />
            </div>
            <div className="ff-dates">
              <div className="ff-date-field">
                <span className="ff-date-label">Desde</span>
                <FilterDateInput
                  ariaLabel="Desde"
                  id="bajas-desde"
                  name="from"
                  value={bajasFiltersDraft.from}
                  onChange={onDraftChange}
                  onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
                />
              </div>
              <div className="ff-date-field">
                <span className="ff-date-label">Hasta</span>
                <FilterDateInput
                  ariaLabel="Hasta"
                  id="bajas-hasta"
                  name="to"
                  value={bajasFiltersDraft.to}
                  onChange={onDraftChange}
                  onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="ff-filter-actions-card inventario-bajas-filter-actions-card">
          <div className="ff-actions">
            <button className="btn btn-primary btn-sm" onClick={onApplyFilters} type="button">
              Aplicar
            </button>
            <button className="ff-clear-btn" onClick={onClearFilters} type="button">
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </CollapsibleFilters>

    {bajasLoading && bajas.length === 0 ? (
      <div className="loading">
        <div className="loading-spinner"></div>
        Cargando artículos dados de baja...
      </div>
    ) : bajas.length === 0 ? (
      <div className="inventario-bajas-empty" role="status">
        <p>
          {Object.values(bajasFiltersDraft).some(Boolean)
            ? 'No hay resultados para los filtros aplicados.'
            : 'No hay artículos dados de baja.'}
        </p>
      </div>
    ) : (
      <>
        <LoadingState
          loading={bajasLoading}
          hasRows={bajas.length > 0}
          refreshMessage="Actualizando bajas…"
        />
        <div className="table-result-count">
          Mostrando {bajas.length} de {bajasTotalItems} baja(s)
        </div>

        <div className="table-responsive app-table-shell bajas-table-shell">
          <table className="app-table bajas-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Artículo</th>
                <th>Serie</th>
                <th>Cantidad</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Ubicación</th>
                <th>Usuario</th>
                <th className="cell-motivo-heading">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {bajas.map((baja, idx) => {
                return (
                  <tr key={baja.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td className="app-cell-date">{formatDate(baja.fecha_baja)}</td>
                    <td className="cell-compact">{getTipoLabel(baja.tipo_articulo)}</td>
                    <td className="cell-articulo">{baja.nombre_articulo || '-'}</td>
                    <td className="cell-serie">{getSerieDisplay(baja)}</td>
                    <td className="app-cell-qty">{baja.cantidad ?? '-'}</td>
                    <td className="cell-compact">{baja.marca || '-'}</td>
                    <td className="cell-compact">{baja.modelo || '-'}</td>
                    <td>{baja.ubicacion_nombre || '-'}</td>
                    <td>{baja.usuario || '-'}</td>
                    <td className="cell-motivo">
                      <span className="cell-motivo-text" title={baja.motivo || '-'}>
                        {baja.motivo || '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={bajasPage}
          totalPages={bajasTotalPages}
          onPageChange={onPageChange}
        />
      </>
    )}
  </div>
);

export default BajasTab;
