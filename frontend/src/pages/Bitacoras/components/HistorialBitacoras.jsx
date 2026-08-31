import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FilterDateInput from '../../../components/FilterDateInput';
import PaginationControls from '../../../components/PaginationControls';
import TabularWorkspace from '../../../components/TabularWorkspace';
import bitacorasService from '../../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import { formatLocalTimestamp } from '../utils/bitacorasHelpers';

const EMPTY_FILTERS = Object.freeze({
  autor: '',
  ubicacion_id: '',
  fecha_desde: '',
  fecha_hasta: '',
  estado: '',
});

const EMPTY_META = Object.freeze({
  page: 1,
  pageSize: 25,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

const PAGE_SIZE = 25;

const hasAppliedFilters = (filters) => Object.values(filters).some(Boolean);

const buildHistoryParams = (page, filters) => ({
  page,
  pageSize: PAGE_SIZE,
  ...(filters.ubicacion_id ? { ubicacion_id: Number(filters.ubicacion_id) } : {}),
  ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
  ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {}),
  ...(filters.estado ? { estado: filters.estado } : {}),
  ...(filters.autor ? { autor: filters.autor.trim() } : {}),
});

const getAuthorName = (registro) =>
  registro.autor_colaborador_nombre || registro.autor_usuario || '—';

const getLocationSegments = (registro) =>
  [registro.ubicacion_nombre, registro.manzana_nombre, registro.villa_identificador].filter(
    Boolean
  );

const getStatusClass = (estado) =>
  estado === 'ANULADA' ? 'bitacoras-status--cancelled' : 'bitacoras-status--registered';

const StatusBadge = ({ estado }) => {
  const label = estado === 'ANULADA' ? 'ANULADA' : 'REGISTRADA';
  return <span className={`bitacoras-status ${getStatusClass(label)}`}>{label}</span>;
};

const LocationContext = ({ registro, heading = false }) => {
  const segments = getLocationSegments(registro);
  const content =
    segments.length > 0 ? (
      segments.map((segment, index) => (
        <React.Fragment key={`${segment}-${index}`}>
          {index > 0 ? <span className="bitacoras-location-separator">·</span> : null}
          <span>{segment}</span>
        </React.Fragment>
      ))
    ) : (
      <span>—</span>
    );

  if (heading) return <h3 className="bitacoras-location-context">{content}</h3>;
  return <span className="bitacoras-cell-primary bitacoras-location-context">{content}</span>;
};

const RecordDetails = ({ registro }) => (
  <>
    <div>
      <dt>Fecha/hora</dt>
      <dd>{formatLocalTimestamp(registro.ocurrido_at) || '—'}</dd>
    </div>
    <div>
      <dt>Ubicación</dt>
      <dd>
        <LocationContext registro={registro} />
        {registro.tipo_punto ? <small>{registro.tipo_punto}</small> : null}
      </dd>
    </div>
    <div>
      <dt>Autor</dt>
      <dd>
        {getAuthorName(registro)}
        {registro.autor_colaborador_nombre && registro.autor_usuario ? (
          <small>{registro.autor_usuario}</small>
        ) : null}
      </dd>
    </div>
    <div className="bitacoras-card-detail">
      <dt>Detalle</dt>
      <dd>{registro.detalle || '—'}</dd>
    </div>
  </>
);

const HistorialBitacoras = ({
  ubicaciones,
  locationsLoading,
  locationsError,
  onReloadUbicaciones,
  refreshKey,
}) => {
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS });
  const [dateError, setDateError] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequenceRef = useRef(0);

  const groupedLocations = useMemo(() => {
    const groups = new Map();
    ubicaciones.forEach((ubicacion) => {
      const clientName = ubicacion.cliente_nombre?.trim() || 'Sin cliente';
      if (!groups.has(clientName)) groups.set(clientName, []);
      groups.get(clientName).push(ubicacion);
    });
    return Array.from(groups.entries());
  }, [ubicaciones]);

  const loadHistory = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setLoading(true);
    setError('');

    const result = await bitacorasService.getRegistros(buildHistoryParams(page, appliedFilters));
    if (requestId !== requestSequenceRef.current) return;

    if (!result.success) {
      setError(getVisibleErrorMessage(result, 'No se pudo cargar el historial de Bitácoras.'));
      setLoading(false);
      return;
    }

    const nextMeta = { ...EMPTY_META, ...result.meta };
    const lastValidPage = Math.max(1, Number(nextMeta.totalPages) || 0);
    if (page > lastValidPage) {
      setPage(lastValidPage);
      return;
    }

    setRecords(Array.isArray(result.data) ? result.data : []);
    setMeta(nextMeta);
    setLoading(false);
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadHistory, refreshKey]);

  const handleDraftChange = (event) => {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
    if (name === 'fecha_desde' || name === 'fecha_hasta') setDateError('');
  };

  const handleApply = () => {
    if (
      draftFilters.fecha_desde &&
      draftFilters.fecha_hasta &&
      draftFilters.fecha_desde > draftFilters.fecha_hasta
    ) {
      setDateError('La fecha hasta debe ser igual o posterior a la fecha desde.');
      return;
    }

    setDateError('');
    setAppliedFilters({ ...draftFilters, autor: draftFilters.autor.trim() });
    setPage(1);
  };

  const handleClear = () => {
    setDateError('');
    setDraftFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setPage(1);
  };

  const emptyMessage = hasAppliedFilters(appliedFilters)
    ? 'No hay resultados para los filtros aplicados.'
    : 'No hay registros de Bitácora.';

  const controls = (
    <div className="ff-filter-row bitacoras-filter-row">
      <div className="ff-filter-card bitacoras-filter-card">
        <div className="ff-controls bitacoras-filter-controls">
          <div className="ff-search bitacoras-author-filter">
            <svg
              className="ff-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <label className="sr-only" htmlFor="bitacoras-filter-autor">
              Autor
            </label>
            <input
              id="bitacoras-filter-autor"
              name="autor"
              type="text"
              value={draftFilters.autor}
              onChange={handleDraftChange}
              onKeyDown={(event) => event.key === 'Enter' && handleApply()}
              placeholder="Buscar autor..."
            />
          </div>
          <div className="ff-state bitacoras-location-filter">
            <label className="ff-state-label" htmlFor="bitacoras-filter-ubicacion">
              Ubicación
            </label>
            <select
              id="bitacoras-filter-ubicacion"
              name="ubicacion_id"
              value={draftFilters.ubicacion_id}
              onChange={handleDraftChange}
              disabled={locationsLoading}
            >
              <option value="">Todas</option>
              {groupedLocations.map(([clientName, locations]) => (
                <optgroup key={clientName} label={clientName}>
                  {locations.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {ubicacion.nombre}
                      {ubicacion.tipo_punto ? ` — ${ubicacion.tipo_punto}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {locationsError ? (
              <button
                className="bitacoras-inline-retry"
                type="button"
                onClick={() => onReloadUbicaciones()}
              >
                Reintentar Ubicaciones
              </button>
            ) : null}
          </div>

          <div className="ff-dates bitacoras-date-filters">
            <div className="ff-date-field">
              <label className="ff-date-label" htmlFor="bitacoras-filter-desde">
                Desde
              </label>
              <FilterDateInput
                id="bitacoras-filter-desde"
                name="fecha_desde"
                value={draftFilters.fecha_desde}
                onChange={handleDraftChange}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? 'bitacoras-date-error' : undefined}
              />
            </div>
            <div className="ff-date-field">
              <label className="ff-date-label" htmlFor="bitacoras-filter-hasta">
                Hasta
              </label>
              <FilterDateInput
                id="bitacoras-filter-hasta"
                name="fecha_hasta"
                value={draftFilters.fecha_hasta}
                onChange={handleDraftChange}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? 'bitacoras-date-error' : undefined}
              />
            </div>
          </div>

          <div className="ff-state bitacoras-status-filter">
            <label className="ff-state-label" htmlFor="bitacoras-filter-estado">
              Estado
            </label>
            <select
              id="bitacoras-filter-estado"
              name="estado"
              value={draftFilters.estado}
              onChange={handleDraftChange}
            >
              <option value="">Todos</option>
              <option value="REGISTRADA">REGISTRADA</option>
              <option value="ANULADA">ANULADA</option>
            </select>
          </div>
        </div>
        {dateError ? (
          <p id="bitacoras-date-error" className="bitacoras-filter-error" role="alert">
            {dateError}
          </p>
        ) : null}
      </div>
      <div className="ff-filter-actions-card bitacoras-filter-actions-card">
        <div className="ff-actions">
          <button className="btn btn-primary btn-sm" type="button" onClick={handleApply}>
            Aplicar
          </button>
          <button className="ff-clear-btn" type="button" onClick={handleClear}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );

  const pagination =
    meta.totalPages > 0 ? (
      <PaginationControls page={page} totalPages={meta.totalPages} onPageChange={setPage} />
    ) : null;

  return (
    <TabularWorkspace
      className="bitacoras-history"
      controls={controls}
      summary={
        !loading && !error ? (
          <div className="table-result-count">
            Mostrando {records.length} de {meta.totalItems} registro(s)
          </div>
        ) : null
      }
      pagination={pagination}
    >
      {loading ? (
        <div className="loading bitacoras-history-state" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true" />
          Cargando historial…
        </div>
      ) : error ? (
        <div className="bitacoras-history-state" role="alert">
          <p>{error}</p>
          <button className="btn btn-secondary" type="button" onClick={loadHistory}>
            Reintentar
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="bitacoras-history-state bitacoras-history-empty">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="table-responsive app-table-shell app-table-scroll bitacoras-table-shell">
            <table className="app-table bitacoras-table">
              <thead>
                <tr>
                  <th scope="col">Fecha/hora</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {records.map((registro) => (
                  <tr key={registro.id}>
                    <td className="app-cell-date">
                      {formatLocalTimestamp(registro.ocurrido_at) || '—'}
                    </td>
                    <td>
                      <LocationContext registro={registro} />
                      {registro.tipo_punto ? <small>{registro.tipo_punto}</small> : null}
                    </td>
                    <td>
                      <span className="bitacoras-cell-primary">{getAuthorName(registro)}</span>
                      {registro.autor_colaborador_nombre && registro.autor_usuario ? (
                        <small>{registro.autor_usuario}</small>
                      ) : null}
                    </td>
                    <td className="bitacoras-detail-cell">
                      {registro.detalle || '—'}
                      {registro.estado === 'ANULADA' && registro.motivo_anulacion ? (
                        <small>Motivo: {registro.motivo_anulacion}</small>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge estado={registro.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="records-mobile bitacoras-mobile-records">
            {records.map((registro) => (
              <article key={registro.id} className="record-card bitacoras-record-card">
                <div className="record-card-header">
                  <LocationContext registro={registro} heading />
                  <StatusBadge estado={registro.estado} />
                </div>
                <dl className="record-card-details">
                  <RecordDetails registro={registro} />
                </dl>
                {registro.estado === 'ANULADA' && registro.motivo_anulacion ? (
                  <p className="bitacoras-cancel-reason">
                    <strong>Motivo de anulación:</strong> {registro.motivo_anulacion}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </TabularWorkspace>
  );
};

export default HistorialBitacoras;
