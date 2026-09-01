import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';
import PaginationControls from '../../../components/PaginationControls';
import TabularWorkspace from '../../../components/TabularWorkspace';
import bitacorasService from '../../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import { formatLocalTimestamp } from '../utils/bitacorasHelpers';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = {
  estado: 'ABIERTA',
  creator: '',
  fecha_desde: '',
  fecha_hasta: '',
  search: '',
};
const EMPTY_META = {
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const buildParams = (page, filters) => ({
  page,
  pageSize: PAGE_SIZE,
  ...(filters.estado ? { estado: filters.estado } : {}),
  ...(filters.creator.trim() ? { creator: filters.creator.trim() } : {}),
  ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
  ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {}),
  ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
});

const casaLabel = (visit) =>
  visit.manzana_nombre && visit.villa_identificador
    ? `${visit.manzana_nombre} - ${visit.villa_identificador}`
    : '—';

const VisitActions = ({ visit, closingId, onClose, canCancel, onCancelRequest }) =>
  visit.estado === 'ABIERTA' ? (
    <div className="bitacoras-visit-actions">
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        onClick={() => onClose(visit.id)}
        disabled={closingId === visit.id}
      >
        {closingId === visit.id ? 'Cerrando...' : 'Registrar salida'}
      </button>
      {canCancel ? (
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => onCancelRequest(visit)}
          disabled={closingId === visit.id}
        >
          Anular
        </button>
      ) : null}
    </div>
  ) : (
    '—'
  );

const HistorialVisitas = ({
  refreshKey,
  onChanged,
  showToast,
  onFiltersChange,
  canCancelVisita = false,
  onTotalChange,
}) => {
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS });
  const [dateError, setDateError] = useState('');
  const [page, setPage] = useState(1);
  const [visits, setVisits] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState(null);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [creators, setCreators] = useState([]);
  const requestSequenceRef = useRef(0);

  const loadVisits = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setLoading(true);
    setError('');
    const result = await bitacorasService.getVisitas(buildParams(page, appliedFilters));
    if (requestId !== requestSequenceRef.current) return;
    if (!result.success) {
      setError(getVisibleErrorMessage(result, 'No se pudo cargar el historial de visitas.'));
      setLoading(false);
      return;
    }
    setVisits(Array.isArray(result.data) ? result.data : []);
    setMeta({ ...EMPTY_META, ...result.meta });
    setCreators(Array.isArray(result.filters?.creators) ? result.filters.creators : []);
    setLoading(false);
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadVisits();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadVisits, refreshKey]);

  useEffect(() => {
    onFiltersChange?.(buildParams(undefined, appliedFilters));
  }, [appliedFilters, onFiltersChange]);

  useEffect(() => {
    onTotalChange?.(meta.totalItems);
  }, [meta.totalItems, onTotalChange]);

  const updateFilter = (event) => {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
    if (name === 'fecha_desde' || name === 'fecha_hasta') setDateError('');
  };

  const applyFilters = () => {
    if (
      draftFilters.fecha_desde &&
      draftFilters.fecha_hasta &&
      draftFilters.fecha_desde > draftFilters.fecha_hasta
    ) {
      setDateError('La fecha hasta debe ser igual o posterior a la fecha desde.');
      return;
    }
    setDateError('');
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const closeVisit = async (visitId) => {
    setClosingId(visitId);
    const result = await bitacorasService.closeVisita(visitId);
    setClosingId(null);
    if (result.success) {
      showToast(result.message || 'Visita cerrada.', 'success');
      onChanged();
      void loadVisits();
      return;
    }
    showToast(getVisibleErrorMessage(result, 'No se pudo cerrar la visita.'), 'error');
  };

  const openCancelModal = (visit) => {
    setCancelTarget(visit);
    setCancelMotivo('');
  };

  const closeCancelModal = () => {
    if (isCancelling) return;
    setCancelTarget(null);
    setCancelMotivo('');
  };

  const submitCancel = async (event) => {
    event.preventDefault();
    if (!cancelTarget || isCancelling) return;
    if (!cancelMotivo.trim()) {
      showToast('Ingresa el motivo de anulación.', 'error');
      return;
    }
    setIsCancelling(true);
    const result = await bitacorasService.cancelVisita(cancelTarget.id, {
      motivo: cancelMotivo.trim(),
    });
    setIsCancelling(false);
    if (result.success) {
      showToast(result.message || 'Visita anulada.', 'success');
      setCancelTarget(null);
      setCancelMotivo('');
      onChanged();
      void loadVisits();
      return;
    }
    showToast(getVisibleErrorMessage(result, 'No se pudo anular la visita.'), 'error');
  };

  const controls = (
    <div className="ff-filter-row bitacoras-filter-row">
      <div className="ff-filter-card bitacoras-filter-card">
        <div className="ff-controls bitacoras-filter-controls bitacoras-visit-filters">
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
              value={draftFilters.search}
              onChange={updateFilter}
              onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
              placeholder="Visitante, placa, casa o titular..."
            />
          </div>
          <div className="ff-state bitacoras-status-filter">
            <label className="ff-state-label" htmlFor="visitas-filter-creator">
              Creador
            </label>
            <select
              id="visitas-filter-creator"
              name="creator"
              value={draftFilters.creator}
              onChange={updateFilter}
            >
              <option value="">Todos</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.nombre}>
                  {creator.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="ff-state bitacoras-status-filter">
            <label className="ff-state-label" htmlFor="visitas-filter-estado">
              Estado
            </label>
            <select
              id="visitas-filter-estado"
              name="estado"
              value={draftFilters.estado}
              onChange={updateFilter}
            >
              <option value="">Todos</option>
              <option value="ABIERTA">ABIERTA</option>
              <option value="CERRADA">CERRADA</option>
              <option value="ANULADA">ANULADA</option>
            </select>
          </div>
          <div className="ff-dates bitacoras-date-filters">
            <FilterDateInput
              aria-label="Desde"
              name="fecha_desde"
              value={draftFilters.fecha_desde}
              onChange={updateFilter}
            />
            <FilterDateInput
              aria-label="Hasta"
              name="fecha_hasta"
              value={draftFilters.fecha_hasta}
              onChange={updateFilter}
            />
          </div>
        </div>
        {dateError ? <p className="bitacoras-filter-error">{dateError}</p> : null}
      </div>
      <div className="ff-filter-actions-card bitacoras-filter-actions-card">
        <div className="ff-actions">
          <button className="btn btn-primary btn-sm" type="button" onClick={applyFilters}>
            Aplicar
          </button>
          <button
            className="ff-clear-btn"
            type="button"
            onClick={() => {
              setDraftFilters({ ...EMPTY_FILTERS });
              setAppliedFilters({ ...EMPTY_FILTERS });
              setPage(1);
            }}
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <TabularWorkspace
        className="bitacoras-history"
        controls={controls}
        summary={
          !loading && !error ? (
            <div className="table-result-count">
              Mostrando {visits.length} de {meta.totalItems} visita(s)
            </div>
          ) : null
        }
        pagination={
          !loading && !error && meta.totalItems > 0 ? (
            <PaginationControls page={page} totalPages={meta.totalPages} onPageChange={setPage} />
          ) : null
        }
      >
        {loading ? (
          <div className="loading bitacoras-history-state">Cargando visitas...</div>
        ) : error ? (
          <div className="bitacoras-history-state" role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" type="button" onClick={loadVisits}>
              Reintentar
            </button>
          </div>
        ) : visits.length === 0 ? (
          <div className="bitacoras-history-state bitacoras-history-empty">
            <p>No hay visitas para los filtros aplicados.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive app-table-shell app-table-scroll bitacoras-table-shell">
              <table className="app-table bitacoras-visits-table">
                <thead>
                  <tr>
                    <th>Ingreso</th>
                    <th>Visitante</th>
                    <th>Placa</th>
                    <th>Casa</th>
                    <th>Titular</th>
                    <th>Estado</th>
                    <th>Salida</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit, index) => (
                    <tr key={visit.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td>{formatLocalTimestamp(visit.entrada_at) || '—'}</td>
                      <td>
                        <span className="bitacoras-cell-primary">{visit.visitante_nombre}</span>
                        <small>{visit.visitante_documento}</small>
                      </td>
                      <td>{visit.placa}</td>
                      <td>{casaLabel(visit)}</td>
                      <td>{visit.residente_principal_nombre || '—'}</td>
                      <td>{visit.estado}</td>
                      <td>{formatLocalTimestamp(visit.salida_at) || '—'}</td>
                      <td>
                        <VisitActions
                          visit={visit}
                          closingId={closingId}
                          onClose={closeVisit}
                          canCancel={canCancelVisita}
                          onCancelRequest={openCancelModal}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="records-mobile bitacoras-mobile-records">
              {visits.map((visit) => (
                <article key={visit.id} className="record-card bitacoras-record-card">
                  <div className="record-card-header">
                    <h3>{visit.visitante_nombre || '—'}</h3>
                    <span className="bitacoras-cell-primary">{visit.estado}</span>
                  </div>
                  <dl className="record-card-details">
                    <div>
                      <dt>Ingreso</dt>
                      <dd>{formatLocalTimestamp(visit.entrada_at) || '—'}</dd>
                    </div>
                    <div>
                      <dt>Cédula</dt>
                      <dd>{visit.visitante_documento || '—'}</dd>
                    </div>
                    <div>
                      <dt>Placa</dt>
                      <dd>{visit.placa || '—'}</dd>
                    </div>
                    <div>
                      <dt>Casa</dt>
                      <dd>{casaLabel(visit)}</dd>
                    </div>
                    <div>
                      <dt>Titular</dt>
                      <dd>{visit.residente_principal_nombre || '—'}</dd>
                    </div>
                    <div>
                      <dt>Salida</dt>
                      <dd>{formatLocalTimestamp(visit.salida_at) || '—'}</dd>
                    </div>
                    <div>
                      <dt>Acciones</dt>
                      <dd>
                        <VisitActions
                          visit={visit}
                          closingId={closingId}
                          onClose={closeVisit}
                          canCancel={canCancelVisita}
                          onCancelRequest={openCancelModal}
                        />
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </TabularWorkspace>

      {cancelTarget ? (
        <AppModal
          isOpen
          onClose={closeCancelModal}
          closeOnBackdrop={!isCancelling}
          closeButtonDisabled={isCancelling}
          title="Anular visita"
          size="lg"
          className="bitacoras-cancel-visita-modal"
        >
          <form onSubmit={submitCancel}>
            <AppModal.Header />
            <AppModal.Body>
              <div className="modal-context">
                <span>
                  Visitante: <strong>{cancelTarget.visitante_nombre}</strong>
                </span>
                <span>
                  Casa: <strong>{casaLabel(cancelTarget)}</strong>
                </span>
              </div>
              <div className="form-group">
                <label htmlFor="cancel-visita-motivo">Motivo de anulación</label>
                <textarea
                  id="cancel-visita-motivo"
                  value={cancelMotivo}
                  onChange={(event) => setCancelMotivo(event.target.value)}
                  placeholder="Explica por qué se anula la visita..."
                  rows={4}
                  maxLength={200}
                  disabled={isCancelling}
                />
                <span className="field-help">{cancelMotivo.length}/200</span>
              </div>
            </AppModal.Body>
            <AppModal.Footer className="modal-buttons">
              <button type="submit" className="btn btn-primary" disabled={isCancelling}>
                {isCancelling ? 'Anulando...' : 'Confirmar anulación'}
              </button>
              <button
                type="button"
                className="btn btn-modal-clear"
                onClick={closeCancelModal}
                disabled={isCancelling}
              >
                Cancelar
              </button>
            </AppModal.Footer>
          </form>
        </AppModal>
      ) : null}
    </>
  );
};

export default HistorialVisitas;
