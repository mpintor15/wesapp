import {
  formatDate,
  getBajaActionState,
  getEstadoOperativoClass,
  getEstadoOperativoLabel,
  getReversalStatus,
  getSerieDisplay,
  getTipoLabel,
  REVERSAL_STATUS_LABELS,
} from '../utils/inventarioHelpers';
import FilterDateInput from '../../../components/FilterDateInput';

const BajasTab = ({
  bajas,
  bajasFiltersDraft,
  bajasLoading,
  onDeleteBaja,
  onApplyFilters,
  onClearFilters,
  onDraftChange,
  onVoidBaja,
  permissions,
}) => (
  <div className="tab-content">
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

    {bajasLoading ? (
      <div className="loading">
        <div className="loading-spinner"></div>
        Cargando artículos dados de baja...
      </div>
    ) : (
      <>
        <div className="table-result-count">Mostrando {bajas.length} baja(s)</div>

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
                <th>Estado</th>
                <th>Reversión</th>
                <th className="col-actions app-col-actions app-col-actions--double"></th>
              </tr>
            </thead>
            <tbody>
              {bajas.length > 0 ? (
                bajas.map((baja, idx) => {
                  const actions = getBajaActionState(baja, permissions);
                  const reversalStatus = getReversalStatus(baja);
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
                      <td>
                        <span
                          className={`status-badge ${getEstadoOperativoClass(baja.estado)}`}
                          aria-label={`Estado: ${getEstadoOperativoLabel(baja.estado)}`}
                        >
                          {getEstadoOperativoLabel(baja.estado)}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge status-badge--neutral">
                          {REVERSAL_STATUS_LABELS[reversalStatus] || reversalStatus}
                        </span>
                      </td>
                      <td className="col-actions app-col-actions app-col-actions--double">
                        {actions.hasAnyAction ? (
                          <div className="action-buttons app-table-actions">
                            {actions.canVoid && (
                              <button
                                className="action-btn action-btn-baja"
                                type="button"
                                title="Anular baja"
                                onClick={() => onVoidBaja(baja)}
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
                                title="Eliminar baja administrativamente"
                                onClick={() => onDeleteBaja(baja)}
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
                  <td colSpan="13" className="text-center">
                    No hay artículos dados de baja.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>
);

export default BajasTab;
