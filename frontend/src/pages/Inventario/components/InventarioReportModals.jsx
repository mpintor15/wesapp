import { INVENTARIO_ESTADOS, INVENTARIO_TIPOS } from '../utils/inventarioHelpers';

const LoadingLabel = ({ loading }) =>
  loading ? (
    <>
      <span className="spinner spinner--sm" />
      Generando…
    </>
  ) : (
    'Exportar reporte'
  );

const InventarioReportModals = ({
  bajasExportFilters,
  exportFilters,
  isExportingArticulos,
  isExportingBajas,
  isExportingMovimientos,
  movimientosExportFilters,
  onArticulosExport,
  onArticulosFilterChange,
  onBajasExport,
  onBajasFilterChange,
  onCancelArticulos,
  onCancelBajas,
  onCancelMovimientos,
  onMovimientosExport,
  onMovimientosFilterChange,
  showBajasExportModal,
  showExportModal,
  showMovimientosExportModal,
  ubicaciones,
}) => (
  <>
    {showExportModal && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onCancelArticulos()}
      >
        <div className="modal modal-export" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Reporte de inventario</h3>
            <button className="modal-close" onClick={onCancelArticulos} type="button">
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="export-form-grid">
              <div className="form-group">
                <label htmlFor="export-tipo">Tipo</label>
                <select
                  id="export-tipo"
                  value={exportFilters.tipo}
                  onChange={(e) =>
                    onArticulosFilterChange((prev) => ({ ...prev, tipo: e.target.value }))
                  }
                >
                  {INVENTARIO_TIPOS.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="export-ubicacion">Ubicación</label>
                <select
                  id="export-ubicacion"
                  value={exportFilters.ubicacion_id}
                  onChange={(e) =>
                    onArticulosFilterChange((prev) => ({ ...prev, ubicacion_id: e.target.value }))
                  }
                >
                  <option value="">Todas las ubicaciones</option>
                  {ubicaciones.map((ub) => (
                    <option key={ub.id} value={ub.id}>
                      {ub.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="export-estado">Estado</label>
                <select
                  id="export-estado"
                  value={exportFilters.estado}
                  onChange={(e) =>
                    onArticulosFilterChange((prev) => ({ ...prev, estado: e.target.value }))
                  }
                >
                  {INVENTARIO_ESTADOS.map((estado) => (
                    <option key={estado.value} value={estado.value}>
                      {estado.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-buttons export-modal-actions">
            <button
              className="btn btn-primary"
              onClick={onArticulosExport}
              disabled={isExportingArticulos}
              type="button"
            >
              <LoadingLabel loading={isExportingArticulos} />
            </button>
            <button
              className="btn btn-modal-clear"
              onClick={onCancelArticulos}
              disabled={isExportingArticulos}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

    {showBajasExportModal && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onCancelBajas()}
      >
        <div className="modal modal-export" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Reporte de dados de baja</h3>
            <button className="modal-close" onClick={onCancelBajas} type="button">
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="export-form-grid">
              <div className="form-group">
                <label htmlFor="bajas-export-from">Desde</label>
                <input
                  id="bajas-export-from"
                  type="date"
                  value={bajasExportFilters.from}
                  onChange={(e) =>
                    onBajasFilterChange((prev) => ({ ...prev, from: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="bajas-export-to">Hasta</label>
                <input
                  id="bajas-export-to"
                  type="date"
                  value={bajasExportFilters.to}
                  onChange={(e) => onBajasFilterChange((prev) => ({ ...prev, to: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="modal-buttons export-modal-actions">
            <button
              className="btn btn-primary"
              onClick={onBajasExport}
              disabled={isExportingBajas}
              type="button"
            >
              <LoadingLabel loading={isExportingBajas} />
            </button>
            <button
              className="btn btn-modal-clear"
              onClick={onCancelBajas}
              disabled={isExportingBajas}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

    {showMovimientosExportModal && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onCancelMovimientos()}
      >
        <div className="modal modal-export" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Reporte de movimientos</h3>
            <button className="modal-close" onClick={onCancelMovimientos} type="button">
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="export-form-grid">
              <div className="form-group">
                <label htmlFor="mov-export-destino">Destino</label>
                <select
                  id="mov-export-destino"
                  value={movimientosExportFilters.destino_id}
                  onChange={(e) =>
                    onMovimientosFilterChange((prev) => ({
                      ...prev,
                      destino_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Todos los destinos</option>
                  {ubicaciones.map((ub) => (
                    <option key={ub.id} value={ub.id}>
                      {ub.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="mov-export-from">Desde</label>
                <input
                  id="mov-export-from"
                  type="date"
                  value={movimientosExportFilters.from}
                  onChange={(e) =>
                    onMovimientosFilterChange((prev) => ({ ...prev, from: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="mov-export-to">Hasta</label>
                <input
                  id="mov-export-to"
                  type="date"
                  value={movimientosExportFilters.to}
                  onChange={(e) =>
                    onMovimientosFilterChange((prev) => ({ ...prev, to: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="modal-buttons export-modal-actions">
            <button
              className="btn btn-primary"
              onClick={onMovimientosExport}
              disabled={isExportingMovimientos}
              type="button"
            >
              <LoadingLabel loading={isExportingMovimientos} />
            </button>
            <button
              className="btn btn-modal-clear"
              onClick={onCancelMovimientos}
              disabled={isExportingMovimientos}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default InventarioReportModals;
