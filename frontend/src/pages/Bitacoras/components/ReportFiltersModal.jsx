import React from 'react';
import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';

const TITLES = {
  historial: 'Generar reporte de Bitácoras',
  visitas: 'Generar reporte de Visitas',
  formularios: 'Generar reporte de Formularios',
};

const HISTORIAL_ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'REGISTRADA', label: 'Registrada' },
  { value: 'ANULADA', label: 'Anulada' },
];
const VISITA_ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'ABIERTA', label: 'Abierta' },
  { value: 'CERRADA', label: 'Cerrada' },
  { value: 'ANULADA', label: 'Anulada' },
  { value: 'NO_AUTORIZADA', label: 'No autorizada' },
];
const FORMULARIO_ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

const UbicacionSelect = ({ value, onChange, ubicaciones }) => (
  <select value={value} onChange={(e) => onChange('ubicacion_id', e.target.value)}>
    <option value="">Todas</option>
    {ubicaciones.map((ubicacion) => (
      <option key={ubicacion.id} value={ubicacion.id}>
        {ubicacion.nombre}
      </option>
    ))}
  </select>
);

const ReportFiltersModal = ({
  isOpen,
  onClose,
  onExport,
  onFilterChange,
  onClear,
  isSubmitting,
  filters,
  ubicaciones,
  activeView,
}) => {
  if (!isOpen) return null;

  const setField = (field, value) => onFilterChange(field, value);
  const handleDate = (event) => setField(event.target.name, event.target.value);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={TITLES[activeView] || 'Generar reporte'}
      size="sm"
      closeOnBackdrop
      closeButtonDisabled={isSubmitting}
    >
      <AppModal.Header />
      <AppModal.Body>
        <div className="bitacoras-registro-grid">
          {activeView === 'historial' ? (
            <>
              <div className="form-group">
                <label>Ubicación</label>
                <UbicacionSelect
                  value={filters.ubicacion_id}
                  onChange={setField}
                  ubicaciones={ubicaciones}
                />
              </div>
              <div className="form-group">
                <label>Desde</label>
                <FilterDateInput
                  name="fecha_desde"
                  value={filters.fecha_desde}
                  onChange={handleDate}
                />
              </div>
              <div className="form-group">
                <label>Hasta</label>
                <FilterDateInput
                  name="fecha_hasta"
                  value={filters.fecha_hasta}
                  onChange={handleDate}
                />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={filters.estado} onChange={(e) => setField('estado', e.target.value)}>
                  {HISTORIAL_ESTADOS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Autor</label>
                <input
                  type="text"
                  value={filters.autor}
                  onChange={(e) => setField('autor', e.target.value)}
                  placeholder="Nombre del autor"
                />
              </div>
            </>
          ) : null}

          {activeView === 'visitas' ? (
            <>
              <div className="form-group">
                <label>Ubicación</label>
                <UbicacionSelect
                  value={filters.ubicacion_id}
                  onChange={setField}
                  ubicaciones={ubicaciones}
                />
              </div>
              <div className="form-group">
                <label>Desde</label>
                <FilterDateInput
                  name="fecha_desde"
                  value={filters.fecha_desde}
                  onChange={handleDate}
                />
              </div>
              <div className="form-group">
                <label>Hasta</label>
                <FilterDateInput
                  name="fecha_hasta"
                  value={filters.fecha_hasta}
                  onChange={handleDate}
                />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={filters.estado} onChange={(e) => setField('estado', e.target.value)}>
                  {VISITA_ESTADOS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Creado por</label>
                <input
                  type="text"
                  value={filters.creator}
                  onChange={(e) => setField('creator', e.target.value)}
                  placeholder="Nombre del creador"
                />
              </div>
              <div className="form-group">
                <label>Búsqueda</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setField('search', e.target.value)}
                  placeholder="Visitante, cédula, placa..."
                />
              </div>
            </>
          ) : null}

          {activeView === 'formularios' ? (
            <>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={filters.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder="Nombre del formulario"
                />
              </div>
              <div className="form-group">
                <label>Ubicación</label>
                <UbicacionSelect
                  value={filters.ubicacion_id}
                  onChange={setField}
                  ubicaciones={ubicaciones}
                />
              </div>
              <div className="form-group">
                <label>Creado por</label>
                <input
                  type="text"
                  value={filters.creator}
                  onChange={(e) => setField('creator', e.target.value)}
                  placeholder="Nombre del creador"
                />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={filters.estado} onChange={(e) => setField('estado', e.target.value)}>
                  {FORMULARIO_ESTADOS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>
      </AppModal.Body>
      <AppModal.Footer className="modal-buttons">
        <button
          className="btn btn-primary"
          type="button"
          onClick={onExport}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Generando…' : 'Generar reporte'}
        </button>
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
      </AppModal.Footer>
    </AppModal>
  );
};

export default ReportFiltersModal;
