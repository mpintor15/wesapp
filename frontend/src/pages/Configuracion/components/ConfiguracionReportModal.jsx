import React from 'react';
import AppModal from '../../../components/AppModal';

const TITLES = {
  clientes: 'Generar reporte de Clientes',
  ubicaciones: 'Generar reporte de Ubicaciones',
};

const ConfiguracionReportModal = ({
  type,
  filters,
  clientes = [],
  isSubmitting,
  onFilterChange,
  onClear,
  onExport,
  onClose,
}) => {
  const setField = (event) => onFilterChange(event.target.name, event.target.value);

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={TITLES[type]}
      className="configuracion-report-modal"
      closeOnBackdrop
      closeButtonDisabled={isSubmitting}
    >
      <AppModal.Header />
      <AppModal.Body className="configuracion-report-body">
        <div className="configuracion-report-card">
          <div className="form-group configuracion-report-wide">
            <label htmlFor="config-report-search">Búsqueda</label>
            <input
              id="config-report-search"
              name="search"
              type="text"
              value={filters.search}
              onChange={setField}
              placeholder={
                type === 'clientes' ? 'Nombre o identificación...' : 'Cliente o ubicación...'
              }
              maxLength={100}
            />
          </div>
          {type === 'clientes' ? (
            <>
              <div className="form-group">
                <label htmlFor="config-report-estado">Estado</label>
                <select
                  id="config-report-estado"
                  name="estado"
                  value={filters.estado}
                  onChange={setField}
                >
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="config-report-ubicaciones">Ubicaciones</label>
                <select
                  id="config-report-ubicaciones"
                  name="estadoUbicaciones"
                  value={filters.estadoUbicaciones}
                  onChange={setField}
                >
                  <option value="">Todas</option>
                  <option value="con_ubicaciones">Con ubicaciones</option>
                  <option value="sin_ubicaciones">Sin ubicaciones</option>
                </select>
              </div>
            </>
          ) : (
            <div className="form-group configuracion-report-wide">
              <label htmlFor="config-report-cliente">Cliente</label>
              <select
                id="config-report-cliente"
                name="cliente_id"
                value={filters.cliente_id}
                onChange={setField}
              >
                <option value="">Todos</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </AppModal.Body>
      <AppModal.Footer className="configuracion-report-actions">
        <button
          className="btn btn-modal-clear"
          type="button"
          onClick={onClear}
          disabled={isSubmitting}
        >
          Limpiar
        </button>
        <button
          className="btn btn-modal-clear"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={onExport}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Generando…' : 'Generar reporte'}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default ConfiguracionReportModal;
