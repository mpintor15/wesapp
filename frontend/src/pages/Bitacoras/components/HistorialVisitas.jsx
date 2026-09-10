import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../../../components/AppModal';
import CollapsibleFilters from '../../../components/CollapsibleFilters';
import FilterDateInput from '../../../components/FilterDateInput';
import LoadingState from '../../../components/LoadingState';
import PaginationControls from '../../../components/PaginationControls';
import TabularWorkspace from '../../../components/TabularWorkspace';
import bitacorasService from '../../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import SortHeader from '../../Cuentas/components/SortHeader';
import { formatLocalTimestamp } from '../utils/bitacorasHelpers';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = {
  estado: '',
  ubicacion_id: '',
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

const buildParams = (page, filters, sort) => ({
  ...(page ? { page } : {}),
  pageSize: PAGE_SIZE,
  sortBy: sort.field,
  sortOrder: sort.direction,
  ...(filters.estado ? { estado: filters.estado } : {}),
  ...(filters.ubicacion_id ? { ubicacion_id: Number(filters.ubicacion_id) } : {}),
  ...(filters.creator.trim() ? { creator: filters.creator.trim() } : {}),
  ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
  ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {}),
  ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
});

const casaLabel = (visit) =>
  visit.manzana_nombre && visit.villa_identificador
    ? `${visit.manzana_nombre} - ${visit.villa_identificador}`
    : '';

// La placa puede venir del campo fijo legacy (bv.placa) o, en formularios
// dinámicos, como una respuesta de tipo 'placa'.
// Lista de visitantes: prioriza los registros del grupo "Visitantes"
// (Nombre + Cédula, capturados en bitacora_visita_grupo_registros); si la
// visita no usa el grupo, cae a los campos fijos legacy de bitacora_visitas.
const visitantesList = (visit) => {
  const entries = Array.isArray(visit.visitantes) ? visit.visitantes : [];
  if (entries.length > 0) {
    const findValue = (entry, key) =>
      Array.isArray(entry) ? entry.find((item) => item.field_key === key)?.value : undefined;
    return entries.map((entry) => {
      const nombre = findValue(entry, 'nombre') || '';
      const cedula = findValue(entry, 'cedula');
      return cedula ? `${nombre} · ${cedula}` : nombre;
    });
  }
  if (visit.visitante_nombre) {
    return [
      visit.visitante_documento
        ? `${visit.visitante_nombre} · ${visit.visitante_documento}`
        : visit.visitante_nombre,
    ];
  }
  return [];
};

const visitantesSummary = (visit) => visitantesList(visit).join(', ');

const responseValue = (response, onPreviewPhoto) => {
  if (response?.type === 'checkbox') return response.value ? 'Sí' : 'No';
  if (response?.type === 'photo' && response.value) {
    return (
      <button
        className="bitacoras-photo-button"
        type="button"
        onClick={() =>
          onPreviewPhoto({ src: response.value, label: response.label || 'Foto de visita' })
        }
        title={`Ver ${response.label || 'foto de visita'}`}
        aria-label={`Ver ${response.label || 'foto de visita'}`}
      >
        <img
          className="bitacoras-photo-thumbnail"
          src={response.value}
          alt={response.label || 'Foto de visita'}
        />
      </button>
    );
  }
  return response?.value === 0 ? '0' : response?.value || '';
};

const buildDynamicColumns = (visits) => {
  const columns = [];
  if (visits.some((visit) => visitantesList(visit).length > 0)) {
    columns.push({ key: 'visitantes', label: 'Visitantes' });
  }
  if (visits.some((visit) => visit.tipo_visita_nombre)) {
    columns.push({ key: 'tipo_visita', label: 'Tipo de visita' });
  }
  if (visits.some((visit) => visit.manzana_nombre || visit.villa_identificador)) {
    columns.push({ key: 'casa', label: 'Casa' });
  }
  const seen = new Set();
  visits.forEach((visit) =>
    (Array.isArray(visit.respuestas) ? visit.respuestas : []).forEach((response) => {
      if (!response.field_key || seen.has(response.field_key)) return;
      seen.add(response.field_key);
      columns.push({ key: response.field_key, label: response.label || response.field_key });
    })
  );
  if (visits.some((visit) => visit.placa) && !columns.some((column) => column.key === 'placa')) {
    columns.push({ key: 'legacy_placa', label: 'Placa' });
  }
  return columns;
};

const dynamicCell = (visit, column, onPreviewPhoto) => {
  if (column.key === 'visitantes') {
    return (
      <div className="bitacoras-visitantes-list">
        {visitantesList(visit).map((line, index) => (
          <span className="bitacoras-cell-primary" key={`${visit.id}-visitante-${index}`}>
            {line}
          </span>
        ))}
      </div>
    );
  }
  if (column.key === 'tipo_visita') return visit.tipo_visita_nombre || '';
  if (column.key === 'casa') return casaLabel(visit);
  if (column.key === 'legacy_placa') return visit.placa || '';
  const response = (visit.respuestas || []).find((item) => item.field_key === column.key);
  return responseValue(response, onPreviewPhoto);
};

// Estado visible: ABIERTA siempre implica requiere_salida (si no lo
// requiere, createVisita la auto-cierra en la misma transacción), así que
// ABIERTA -> ADENTRO sin ambigüedad. CERRADA se separa en SALIÓ (requería
// salida y ya se registró) vs REGISTRADO (nunca la requirió). ANULADA no
// forma parte de este pase de trabajo y se conserva tal cual.
const visitEstadoLabel = (visit) => {
  if (visit.estado === 'ABIERTA') return 'AUTORIZADO';
  if (visit.estado === 'NO_AUTORIZADA') return 'NO AUTORIZADO';
  if (visit.estado === 'CERRADA') return visit.requiere_salida ? 'SALIÓ' : 'AUTORIZADO';
  return visit.estado;
};

const salidaLabel = (visit) => {
  if (visit.estado === 'ABIERTA') return '';
  if (visit.estado === 'NO_AUTORIZADA' || (visit.estado === 'CERRADA' && !visit.requiere_salida)) {
    return '';
  }
  return formatLocalTimestamp(visit.salida_at) || '';
};

// Observación: solo NO AUTORIZADO tiene algo que mostrar (el motivo de
// rechazo); el resto de estados no tiene un dato equivalente.
const observacionLabel = (visit) =>
  visitEstadoLabel(visit) === 'NO AUTORIZADO' ? visit.motivo_no_autorizacion || '' : '';

// Mismo patrón visual que FormStatus (Formularios): badge-active/badge-
// inactive, sin inventar variantes nuevas.
const VisitStatusBadge = ({ label }) => (
  <span className={`badge badge-${label === 'NO AUTORIZADO' ? 'inactive' : 'active'}`}>
    {label}
  </span>
);

const VisitActions = ({ visit, closingId, onExitRequest, canCancel, onCancelRequest }) => {
  const isAbierta = visit.estado === 'ABIERTA';
  const canRegisterExit = isAbierta && visit.requiere_salida;
  const canAnular = isAbierta && canCancel;
  if (!canRegisterExit && !canAnular) return '';
  const disabled = closingId === visit.id;
  return (
    <div className="action-buttons bitacoras-visit-actions">
      {canRegisterExit ? (
        <button
          className="action-btn action-btn-edit"
          type="button"
          title="Registrar salida"
          aria-label="Registrar salida"
          onClick={() => onExitRequest(visit)}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        </button>
      ) : null}
      {canAnular ? (
        <button
          className="action-btn action-btn-cancel"
          type="button"
          title="Anular visita"
          aria-label="Anular visita"
          onClick={() => onCancelRequest(visit)}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M18 6L6 18M6 6l12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
};

const HistorialVisitas = ({
  ubicaciones = [],
  refreshKey,
  onChanged,
  showToast,
  onFiltersChange,
  canCancelVisita = false,
  onTotalChange,
}) => {
  const urbanizaciones = ubicaciones.filter((ubicacion) => ubicacion.tipo_punto === 'URBANIZACION');
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS });
  const hasAutoSelectedRef = useRef(false);

  // Selecciona automáticamente la primera urbanización disponible para que
  // la tabla nunca mezcle Manzana/Villa de urbanizaciones distintas: esos
  // datos no incluyen a qué urbanización pertenecen en cada fila.
  useEffect(() => {
    if (hasAutoSelectedRef.current || urbanizaciones.length === 0) return;
    hasAutoSelectedRef.current = true;
    const firstId = String(urbanizaciones[0].id);
    setDraftFilters((current) => ({ ...current, ubicacion_id: firstId }));
    setAppliedFilters((current) => ({ ...current, ubicacion_id: firstId }));
  }, [urbanizaciones]);
  const [dateError, setDateError] = useState('');
  const [page, setPage] = useState(1);
  const [visits, setVisits] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [sort, setSort] = useState({ field: 'entrada_at', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState(null);
  const [exitTarget, setExitTarget] = useState(null);
  const [exitAt, setExitAt] = useState(null);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const dynamicColumns = useMemo(() => buildDynamicColumns(visits), [visits]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [creators, setCreators] = useState([]);
  const requestSequenceRef = useRef(0);
  const isClosingRef = useRef(false);
  // Visita recién accionada (ej. registrar salida) que debe seguir visible
  // aunque el filtro activo (ej. estado=ABIERTA por defecto) ya no la
  // incluya. Vive en un ref, no en el resultado de un solo loadVisits(),
  // porque onChanged() dispara un refetch automático (vía refreshKey) que
  // puede llegar después de la carga explícita y pisar su resultado. Se
  // limpia únicamente cuando el usuario cambia filtros/orden/página o pide
  // un refresco manual, para no alterar esas interacciones explícitas.
  const pinnedVisitRef = useRef(null);

  const loadVisits = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setLoading(true);
    setError('');
    const result = await bitacorasService.getVisitas(buildParams(page, appliedFilters, sort));
    if (requestId !== requestSequenceRef.current) return;
    if (!result.success) {
      setError(getVisibleErrorMessage(result, 'No se pudo cargar el historial de visitas.'));
      setLoading(false);
      return;
    }
    let data = Array.isArray(result.data) ? result.data : [];
    const pinned = pinnedVisitRef.current;
    if (pinned && !data.some((visit) => visit.id === pinned.id)) {
      data = [pinned, ...data];
    }
    setVisits(data);
    setMeta({ ...EMPTY_META, ...result.meta });
    setCreators(Array.isArray(result.filters?.creators) ? result.filters.creators : []);
    setLoading(false);
  }, [appliedFilters, page, sort]);

  const handleSort = (field) => {
    pinnedVisitRef.current = null;
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const goToPage = (nextPage) => {
    pinnedVisitRef.current = null;
    setPage(nextPage);
  };

  useEffect(() => {
    void loadVisits();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadVisits, refreshKey]);

  useEffect(() => {
    onFiltersChange?.(buildParams(undefined, appliedFilters, sort));
  }, [appliedFilters, onFiltersChange, sort]);

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
    pinnedVisitRef.current = null;
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const openExitModal = (visit) => {
    setExitTarget(visit);
    setExitAt(new Date());
  };

  const closeExitModal = () => {
    if (closingId) return;
    setExitTarget(null);
    setExitAt(null);
  };

  const confirmExit = async () => {
    if (!exitTarget || isClosingRef.current) return;
    isClosingRef.current = true;
    const visitId = exitTarget.id;
    setClosingId(visitId);
    const result = await bitacorasService.closeVisita(visitId);
    isClosingRef.current = false;
    setClosingId(null);
    if (result.success) {
      showToast(result.message || 'Visita cerrada.', 'success');
      pinnedVisitRef.current = { ...exitTarget, ...result.data };
      setExitTarget(null);
      setExitAt(null);
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
    <CollapsibleFilters>
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
            <div className="ff-state bitacoras-status-filter bitacoras-urbanizacion-filter">
              <label className="ff-state-label" htmlFor="visitas-filter-ubicacion">
                Urbanización
              </label>
              <select
                id="visitas-filter-ubicacion"
                name="ubicacion_id"
                value={draftFilters.ubicacion_id}
                onChange={updateFilter}
              >
                {urbanizaciones.length === 0 ? <option value="">Sin urbanizaciones</option> : null}
                {urbanizaciones.map((urbanizacion) => (
                  <option key={urbanizacion.id} value={urbanizacion.id}>
                    {urbanizacion.nombre}
                  </option>
                ))}
              </select>
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
                <option value="NO_AUTORIZADA">NO AUTORIZADA</option>
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
                const preservedUbicacionId =
                  urbanizaciones.length > 0 ? draftFilters.ubicacion_id : '';
                setDraftFilters({ ...EMPTY_FILTERS, ubicacion_id: preservedUbicacionId });
                setAppliedFilters({ ...EMPTY_FILTERS, ubicacion_id: preservedUbicacionId });
                setPage(1);
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </CollapsibleFilters>
  );

  return (
    <>
      <TabularWorkspace
        className="bitacoras-history"
        controls={controls}
        summary={
          !(loading && visits.length === 0) && !error ? (
            <div className="table-result-count">
              Mostrando {visits.length} de {meta.totalItems} visita(s)
            </div>
          ) : null
        }
        pagination={
          !(loading && visits.length === 0) && !error ? (
            <PaginationControls page={page} totalPages={meta.totalPages} onPageChange={goToPage} />
          ) : null
        }
      >
        {loading && visits.length === 0 ? (
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
            <LoadingState
              loading={loading}
              hasRows={visits.length > 0}
              refreshMessage="Actualizando visitas…"
            />
            <div className="table-responsive app-table-shell app-table-scroll bitacoras-table-shell">
              <table className="app-table bitacoras-visits-table">
                <thead>
                  <tr>
                    <SortHeader
                      field="entrada_at"
                      label="Ingreso"
                      sort={sort}
                      onSort={handleSort}
                    />
                    {dynamicColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <SortHeader
                      className="bitacoras-visit-state"
                      field="estado"
                      label="Estado"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <SortHeader field="salida_at" label="Salida" sort={sort} onSort={handleSort} />
                    <SortHeader
                      className="bitacoras-cell-observacion"
                      field="observacion"
                      label="Observación"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <th className="app-col-actions app-col-actions--double" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit, index) => (
                    <tr key={visit.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td>{formatLocalTimestamp(visit.entrada_at) || ''}</td>
                      {dynamicColumns.map((column) => (
                        <td key={column.key}>{dynamicCell(visit, column, setPreviewPhoto)}</td>
                      ))}
                      <td className="bitacoras-visit-state">
                        <VisitStatusBadge label={visitEstadoLabel(visit)} />
                      </td>
                      <td className="bitacoras-cell-salida">{salidaLabel(visit)}</td>
                      <td className="bitacoras-cell-observacion">{observacionLabel(visit)}</td>
                      <td className="app-col-actions app-col-actions--double">
                        <VisitActions
                          visit={visit}
                          closingId={closingId}
                          onExitRequest={openExitModal}
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
                    <h3>{visitantesSummary(visit)}</h3>
                    <VisitStatusBadge label={visitEstadoLabel(visit)} />
                  </div>
                  <dl className="record-card-details">
                    <div>
                      <dt>Ingreso</dt>
                      <dd>{formatLocalTimestamp(visit.entrada_at) || ''}</dd>
                    </div>
                    {dynamicColumns.map((column) => (
                      <div key={column.key}>
                        <dt>{column.label}</dt>
                        <dd>{dynamicCell(visit, column, setPreviewPhoto)}</dd>
                      </div>
                    ))}
                    <div>
                      <dt>Estado</dt>
                      <dd>
                        <VisitStatusBadge label={visitEstadoLabel(visit)} />
                      </dd>
                    </div>
                    <div>
                      <dt>Salida</dt>
                      <dd>{salidaLabel(visit)}</dd>
                    </div>
                    {observacionLabel(visit) ? (
                      <div>
                        <dt>Observación</dt>
                        <dd>{observacionLabel(visit)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Acciones</dt>
                      <dd>
                        <VisitActions
                          visit={visit}
                          closingId={closingId}
                          onExitRequest={openExitModal}
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

      {previewPhoto ? (
        <AppModal
          isOpen
          onClose={() => setPreviewPhoto(null)}
          title={previewPhoto.label}
          size="lg"
          closeOnBackdrop
          className="bitacoras-photo-preview-modal"
        >
          <AppModal.Header />
          <AppModal.Body>
            <div className="bitacoras-photo-preview">
              <img src={previewPhoto.src} alt={previewPhoto.label} />
            </div>
          </AppModal.Body>
          <AppModal.Footer className="modal-buttons">
            <button
              className="btn btn-modal-clear"
              type="button"
              onClick={() => setPreviewPhoto(null)}
            >
              Cerrar
            </button>
          </AppModal.Footer>
        </AppModal>
      ) : null}

      {exitTarget ? (
        <AppModal
          isOpen
          onClose={closeExitModal}
          closeOnBackdrop={!closingId}
          closeButtonDisabled={Boolean(closingId)}
          title="Registrar salida"
          size="md"
          className="bitacoras-exit-visita-modal"
        >
          <AppModal.Header />
          <AppModal.Body>
            <div className="modal-context">
              <span className="bitacoras-exit-visitors">
                Visitantes:
                <strong>
                  {visitantesList(exitTarget).map((visitor, index) => (
                    <span key={`${exitTarget.id}-exit-visitor-${index}`}>{visitor}</span>
                  ))}
                </strong>
              </span>
              <span>
                Casa: <strong>{casaLabel(exitTarget)}</strong>
              </span>
              <span>
                Fecha/hora: <strong>{formatLocalTimestamp(exitAt?.toISOString()) || '—'}</strong>
              </span>
            </div>
          </AppModal.Body>
          <AppModal.Footer className="modal-buttons">
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmExit}
              disabled={Boolean(closingId)}
            >
              {closingId ? 'Registrando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              className="btn btn-modal-clear"
              onClick={closeExitModal}
              disabled={Boolean(closingId)}
            >
              Cancelar
            </button>
          </AppModal.Footer>
        </AppModal>
      ) : null}

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
                  Visitantes: <strong>{visitantesSummary(cancelTarget)}</strong>
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
