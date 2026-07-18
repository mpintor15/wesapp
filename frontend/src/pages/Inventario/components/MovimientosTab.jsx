import {
  formatDate,
  getEstadoOperativoClass,
  getEstadoOperativoLabel,
  getMovimientoActionState,
  getReversalStatus,
  REVERSAL_STATUS_LABELS,
} from '../utils/inventarioHelpers';
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
  onDeleteMovimiento,
  onDownloadPdf,
  onDraftChange,
  onPageChange,
  onRegeneratePdf,
  onSort,
  onVoidMovimiento,
  paginatedMovimientos,
  permissions,
  regeneratingPdfId,
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
                <th>Estado</th>
                <th>Reversión</th>
                <th className="col-actions app-col-actions app-col-actions--triple"></th>
              </tr>
            </thead>
            <tbody>
              {sortedMovimientos.length > 0 ? (
                paginatedMovimientos.map((mov, idx) => {
                  const actions = getMovimientoActionState(mov, permissions);
                  const reversalStatus = getReversalStatus(mov);
                  return (
                    <tr key={mov.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td className="app-cell-date">{formatDate(mov.fecha_movimiento)}</td>
                      <td className="app-cell-qty">{mov.items}</td>
                      <td>{mov.articulos_movidos || '-'}</td>
                      <td>{mov.ubicacion_origen || '-'}</td>
                      <td>{mov.ubicacion_destino || '-'}</td>
                      <td>{mov.usuario || '-'}</td>
                      <td>
                        <span
                          className={`status-badge ${getEstadoOperativoClass(mov.estado)}`}
                          aria-label={`Estado: ${getEstadoOperativoLabel(mov.estado)}`}
                        >
                          {getEstadoOperativoLabel(mov.estado)}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge status-badge--neutral">
                          {REVERSAL_STATUS_LABELS[reversalStatus] || reversalStatus}
                        </span>
                      </td>
                      <td className="col-actions app-col-actions app-col-actions--triple">
                        {actions.hasAnyAction ? (
                          <div className="action-buttons app-table-actions">
                            {actions.canDownloadPdf && (
                              <button
                                className="action-btn action-btn-pdf"
                                type="button"
                                title="Descargar PDF existente"
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
                            )}
                            {actions.canRegeneratePdf && (
                              <button
                                className="action-btn action-btn-neutral"
                                type="button"
                                title="Regenerar PDF"
                                disabled={regeneratingPdfId === mov.id}
                                onClick={() => onRegeneratePdf(mov)}
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
                                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                  <path d="M3 21v-5h5" />
                                  <path d="M3 12a9 9 0 0 1 15.74-6.26L21 8" />
                                  <path d="M16 8h5V3" />
                                </svg>
                              </button>
                            )}
                            {actions.canVoid && (
                              <button
                                className="action-btn action-btn-baja"
                                type="button"
                                title="Anular movimiento"
                                onClick={() => onVoidMovimiento(mov)}
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
                                  <circle cx="12" cy="12" r="8" />
                                  <path d="M8 12h8" />
                                </svg>
                              </button>
                            )}
                            {actions.showDisabledVoid && (
                              <button
                                className="action-btn action-btn-baja"
                                type="button"
                                title={actions.disabledVoidReason}
                                disabled
                                aria-label={actions.disabledVoidReason}
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
                                  <circle cx="12" cy="12" r="8" />
                                  <path d="M8 12h8" />
                                </svg>
                              </button>
                            )}
                            {actions.canDelete && (
                              <button
                                className="action-btn action-btn-del"
                                type="button"
                                title="Eliminar movimiento administrativamente"
                                onClick={() => onDeleteMovimiento(mov)}
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
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="table-action-empty">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="text-center">
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
