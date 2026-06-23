import { formatDate } from '../utils/inventarioHelpers';
import PaginationControls from './PaginationControls';
import SortHeader from './SortHeader';
import FilterDateInput from '../../../components/FilterDateInput';

const MovimientosTab = ({
  movimientosFiltersDraft,
  movimientosLoading,
  movimientosPage,
  movimientosSort,
  movimientosTotalPages,
  onApplyFilters,
  onClearFilters,
  onDownloadPdf,
  onDraftChange,
  onPageChange,
  onSort,
  paginatedMovimientos,
  sortedMovimientos,
  ubicaciones,
}) => (
  <div className="tab-content">
    {movimientosLoading ? (
      <div className="loading">
        <div className="loading-spinner"></div>
        Cargando movimientos...
      </div>
    ) : (
      <>
        <div className="ff-filter-row inventario-movimientos-filter-row">
          <div className="ff-filter-card inventario-movimientos-filter-card">
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
                  value={movimientosFiltersDraft.search}
                  onChange={onDraftChange}
                  onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
                  placeholder="Buscar en artículos, origen o usuario..."
                />
              </div>
              <div className="ff-state movimientos-destino-filter">
                <span className="ff-state-label">Destino</span>
                <select
                  name="destino_id"
                  value={movimientosFiltersDraft.destino_id}
                  onChange={onDraftChange}
                >
                  <option value="">Todos</option>
                  {ubicaciones.map((ub) => (
                    <option key={ub.id} value={ub.id}>
                      {ub.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ff-dates">
                <div className="ff-date-field">
                  <span className="ff-date-label">Desde</span>
                  <FilterDateInput
                    ariaLabel="Desde"
                    id="movimientos-desde"
                    name="from"
                    value={movimientosFiltersDraft.from}
                    onChange={onDraftChange}
                    onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
                  />
                </div>
                <div className="ff-date-field">
                  <span className="ff-date-label">Hasta</span>
                  <FilterDateInput
                    ariaLabel="Hasta"
                    id="movimientos-hasta"
                    name="to"
                    value={movimientosFiltersDraft.to}
                    onChange={onDraftChange}
                    onKeyDown={(e) => e.key === 'Enter' && onApplyFilters()}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="ff-filter-actions-card inventario-movimientos-filter-actions-card">
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

        <div className="table-result-count">
          Mostrando {paginatedMovimientos.length} de {sortedMovimientos.length} movimiento(s)
        </div>

        <div className="table-responsive app-table-shell movimientos-table-shell">
          <table className="app-table movimientos-table">
            <thead>
              <tr>
                <SortHeader
                  field="fecha_movimiento"
                  label="Fecha"
                  sort={movimientosSort}
                  onSort={onSort}
                />
                <SortHeader
                  field="items"
                  label="Cant. Artículos"
                  sort={movimientosSort}
                  onSort={onSort}
                />
                <SortHeader
                  field="articulos_movidos"
                  label="Artículos"
                  sort={movimientosSort}
                  onSort={onSort}
                />
                <SortHeader
                  field="ubicacion_origen"
                  label="Origen"
                  sort={movimientosSort}
                  onSort={onSort}
                />
                <SortHeader
                  field="ubicacion_destino"
                  label="Destino"
                  sort={movimientosSort}
                  onSort={onSort}
                />
                <SortHeader
                  field="usuario"
                  label="Usuario"
                  sort={movimientosSort}
                  onSort={onSort}
                />
                <th className="col-actions app-col-actions app-col-actions--single"></th>
              </tr>
            </thead>
            <tbody>
              {sortedMovimientos.length > 0 ? (
                paginatedMovimientos.map((mov, idx) => (
                  <tr key={mov.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td className="app-cell-date">{formatDate(mov.fecha_movimiento)}</td>
                    <td className="app-cell-qty">{mov.items}</td>
                    <td>{mov.articulos_movidos || '-'}</td>
                    <td>{mov.ubicacion_origen || '-'}</td>
                    <td>{mov.ubicacion_destino || '-'}</td>
                    <td>{mov.usuario || '-'}</td>
                    <td className="col-actions app-col-actions app-col-actions--single">
                      <div className="action-buttons app-table-actions">
                        <button
                          className="action-btn action-btn-pdf"
                          type="button"
                          title="Descargar PDF"
                          onClick={() => onDownloadPdf(mov)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            width="13"
                            height="13"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center">
                    No hay movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {movimientosTotalPages > 1 && (
          <PaginationControls
            page={movimientosPage}
            totalPages={movimientosTotalPages}
            onPageChange={onPageChange}
          />
        )}
      </>
    )}
  </div>
);

export default MovimientosTab;
