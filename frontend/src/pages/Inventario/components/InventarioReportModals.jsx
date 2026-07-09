import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';
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
      <AppModal
        isOpen
        onClose={onCancelArticulos}
        title="Generar reporte de Inventario"
        size="md"
        closeOnBackdrop
        className="inventory-export-modal"
      >
        <AppModal.Header />
        <AppModal.Body>
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
        </AppModal.Body>
        <AppModal.Footer className="export-modal-actions">
          <button
            className="btn btn-primary"
            onClick={onArticulosExport}
            disabled={isExportingArticulos}
            type="button"
          >
            <LoadingLabel loading={isExportingArticulos} />
          </button>
          <button
            className="btn btn-neutral"
            onClick={onCancelArticulos}
            disabled={isExportingArticulos}
            type="button"
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </AppModal>
    )}

    {showBajasExportModal && (
      <AppModal
        isOpen
        onClose={onCancelBajas}
        title="Generar reporte de Dados de baja"
        size="md"
        closeOnBackdrop
        className="inventory-export-modal"
      >
        <AppModal.Header />
        <AppModal.Body>
          <div className="export-form-grid">
            <div className="form-group">
              <label htmlFor="bajas-export-from">Desde</label>
              <FilterDateInput
                id="bajas-export-from"
                name="from"
                value={bajasExportFilters.from}
                onChange={(e) => onBajasFilterChange((prev) => ({ ...prev, from: e.target.value }))}
                className="inventory-date-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="bajas-export-to">Hasta</label>
              <FilterDateInput
                id="bajas-export-to"
                name="to"
                value={bajasExportFilters.to}
                onChange={(e) => onBajasFilterChange((prev) => ({ ...prev, to: e.target.value }))}
                className="inventory-date-input"
              />
            </div>
          </div>
        </AppModal.Body>
        <AppModal.Footer className="export-modal-actions">
          <button
            className="btn btn-primary"
            onClick={onBajasExport}
            disabled={isExportingBajas}
            type="button"
          >
            <LoadingLabel loading={isExportingBajas} />
          </button>
          <button
            className="btn btn-neutral"
            onClick={onCancelBajas}
            disabled={isExportingBajas}
            type="button"
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </AppModal>
    )}

    {showMovimientosExportModal && (
      <AppModal
        isOpen
        onClose={onCancelMovimientos}
        title="Generar reporte de Movimientos"
        size="md"
        closeOnBackdrop
        className="inventory-export-modal"
      >
        <AppModal.Header />
        <AppModal.Body>
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
              <FilterDateInput
                id="mov-export-from"
                name="from"
                value={movimientosExportFilters.from}
                onChange={(e) =>
                  onMovimientosFilterChange((prev) => ({ ...prev, from: e.target.value }))
                }
                className="inventory-date-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="mov-export-to">Hasta</label>
              <FilterDateInput
                id="mov-export-to"
                name="to"
                value={movimientosExportFilters.to}
                onChange={(e) =>
                  onMovimientosFilterChange((prev) => ({ ...prev, to: e.target.value }))
                }
                className="inventory-date-input"
              />
            </div>
          </div>
        </AppModal.Body>
        <AppModal.Footer className="export-modal-actions">
          <button
            className="btn btn-primary"
            onClick={onMovimientosExport}
            disabled={isExportingMovimientos}
            type="button"
          >
            <LoadingLabel loading={isExportingMovimientos} />
          </button>
          <button
            className="btn btn-neutral"
            onClick={onCancelMovimientos}
            disabled={isExportingMovimientos}
            type="button"
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </AppModal>
    )}
  </>
);

export default InventarioReportModals;
