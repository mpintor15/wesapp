import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../../../components/AppModal';
import SearchableSelect from '../../../components/SearchableSelect';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import bitacorasService from '../../../services/bitacorasService';
import { getLocalDateTimeValue, normalizeLocalDateTimeForPayload } from '../utils/bitacorasHelpers';

const EMPTY_ERRORS = {
  ubicacion_id: '',
  manzana_id: '',
  villa_id: '',
  ocurrido_at: '',
  detalle: '',
};
const URBANIZATION_TYPE = 'URBANIZACION';

const getBackendFieldErrors = (result) => {
  const errors = result?.originalError?.response?.data?.errors;
  if (!errors || typeof errors !== 'object') return {};
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ])
  );
};

const getInitialUbicacionId = (ubicaciones, initialUbicacionId) => {
  if (ubicaciones.some((ubicacion) => String(ubicacion.id) === String(initialUbicacionId))) {
    return String(initialUbicacionId);
  }
  return ubicaciones.length === 1 ? String(ubicaciones[0].id) : '';
};

const getUrbanInvalidField = (result, backendErrors = {}) => {
  if (backendErrors.manzana_id) return 'manzana_id';
  if (backendErrors.villa_id) return 'villa_id';
  if (result?.code?.startsWith('BLOCK_') || result?.code === 'URBAN_CONTEXT_NOT_ALLOWED') {
    return 'manzana_id';
  }
  if (result?.code?.startsWith('VILLA_')) return 'villa_id';
  if (result?.code === 'INVALID_URBAN_CHAIN') {
    return result?.message?.toLowerCase().includes('villa') ? 'villa_id' : 'manzana_id';
  }
  return '';
};

const RegistroForm = ({
  isOpen,
  ubicaciones,
  locationsLoading,
  locationsError,
  initialUbicacionId,
  onUbicacionChange,
  onReloadUbicaciones,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [ubicacionId, setUbicacionId] = useState(() =>
    getInitialUbicacionId(ubicaciones, initialUbicacionId)
  );
  const [manzanaId, setManzanaId] = useState('');
  const [villaId, setVillaId] = useState('');
  const [manzanas, setManzanas] = useState([]);
  const [villas, setVillas] = useState([]);
  const [manzanasLoading, setManzanasLoading] = useState(false);
  const [villasLoading, setVillasLoading] = useState(false);
  const [manzanasError, setManzanasError] = useState('');
  const [villasError, setVillasError] = useState('');
  const [ocurridoAt, setOcurridoAt] = useState(() => getLocalDateTimeValue());
  const [detalle, setDetalle] = useState('');
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const manzanasRequestRef = useRef(0);
  const villasRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const currentUbicacionIdRef = useRef(ubicacionId);
  const currentManzanaIdRef = useRef(manzanaId);
  const currentIsUrbanizationRef = useRef(false);
  const ubicacionRef = useRef(null);
  const manzanaRef = useRef(null);
  const villaRef = useRef(null);
  const ocurridoAtRef = useRef(null);
  const detalleRef = useRef(null);

  const selectedLocation = useMemo(
    () => ubicaciones.find((ubicacion) => String(ubicacion.id) === String(ubicacionId)) || null,
    [ubicacionId, ubicaciones]
  );
  const isUrbanization = selectedLocation?.tipo_punto === URBANIZATION_TYPE;
  const normalizedTimestamp = normalizeLocalDateTimeForPayload(ocurridoAt);
  const normalizedDetail = detalle.trim();
  const canSubmit =
    ubicaciones.length > 0 &&
    Number.isInteger(Number(ubicacionId)) &&
    Number(ubicacionId) > 0 &&
    Boolean(normalizedTimestamp) &&
    Boolean(normalizedDetail) &&
    !isSubmitting;

  const groupedLocations = useMemo(() => {
    const groups = new Map();
    ubicaciones.forEach((ubicacion) => {
      const clientName = ubicacion.cliente_nombre?.trim() || 'Sin cliente';
      if (!groups.has(clientName)) groups.set(clientName, []);
      groups.get(clientName).push(ubicacion);
    });
    return Array.from(groups.entries());
  }, [ubicaciones]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      manzanasRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    currentUbicacionIdRef.current = ubicacionId;
    currentManzanaIdRef.current = manzanaId;
    currentIsUrbanizationRef.current = isUrbanization;
  }, [isUrbanization, manzanaId, ubicacionId]);

  const loadManzanas = useCallback(async (nextUbicacionId) => {
    if (!nextUbicacionId) return;
    const requestedUbicacionId = String(nextUbicacionId);
    const requestId = manzanasRequestRef.current + 1;
    manzanasRequestRef.current = requestId;
    setManzanasLoading(true);
    setManzanasError('');
    const result = await bitacorasService.getManzanas(nextUbicacionId);
    if (
      !mountedRef.current ||
      manzanasRequestRef.current !== requestId ||
      currentUbicacionIdRef.current !== requestedUbicacionId ||
      !currentIsUrbanizationRef.current
    ) {
      return;
    }
    setManzanasLoading(false);
    if (result.success) {
      setManzanas(Array.isArray(result.data) ? result.data : []);
      return;
    }
    setManzanas([]);
    setManzanasError(getVisibleErrorMessage(result, 'No se pudieron cargar las Manzanas.'));
  }, []);

  const loadVillas = useCallback(async (nextManzanaId) => {
    if (!nextManzanaId) return;
    const requestedManzanaId = String(nextManzanaId);
    const requestId = villasRequestRef.current + 1;
    villasRequestRef.current = requestId;
    setVillasLoading(true);
    setVillasError('');
    const result = await bitacorasService.getVillas(nextManzanaId);
    if (
      !mountedRef.current ||
      villasRequestRef.current !== requestId ||
      currentManzanaIdRef.current !== requestedManzanaId ||
      !currentIsUrbanizationRef.current
    ) {
      return;
    }
    setVillasLoading(false);
    if (result.success) {
      setVillas(Array.isArray(result.data) ? result.data : []);
      return;
    }
    setVillas([]);
    setVillasError(getVisibleErrorMessage(result, 'No se pudieron cargar las Villas.'));
  }, []);

  useEffect(() => {
    const hasValidInitial = ubicaciones.some(
      (ubicacion) => String(ubicacion.id) === String(initialUbicacionId)
    );
    if (ubicaciones.length !== 1 || hasValidInitial) return;
    const onlyLocationId = String(ubicaciones[0].id);
    if (ubicacionId !== onlyLocationId) setUbicacionId(onlyLocationId);
    onUbicacionChange(onlyLocationId);
  }, [initialUbicacionId, onUbicacionChange, ubicacionId, ubicaciones]);

  useEffect(() => {
    setManzanaId('');
    setVillaId('');
    setManzanas([]);
    setVillas([]);
    setManzanasError('');
    setVillasError('');
    manzanasRequestRef.current += 1;
    villasRequestRef.current += 1;
    setManzanasLoading(false);
    setVillasLoading(false);
    if (isUrbanization && ubicacionId) {
      void loadManzanas(ubicacionId);
    }
  }, [isUrbanization, loadManzanas, ubicacionId]);

  useEffect(() => {
    setVillaId('');
    setVillas([]);
    setVillasError('');
    villasRequestRef.current += 1;
    setVillasLoading(false);
    if (isUrbanization && manzanaId) {
      void loadVillas(manzanaId);
    }
  }, [isUrbanization, loadVillas, manzanaId]);

  useEffect(() => {
    if (errors.ubicacion_id) ubicacionRef.current?.focus();
    else if (errors.manzana_id) manzanaRef.current?.focus();
    else if (errors.villa_id) villaRef.current?.focus();
    else if (errors.ocurrido_at) ocurridoAtRef.current?.focus();
    else if (errors.detalle) detalleRef.current?.focus();
  }, [errors]);

  const handleLocationChange = (value) => {
    const nextUbicacionId = String(value || '');
    const nextLocation =
      ubicaciones.find((ubicacion) => String(ubicacion.id) === nextUbicacionId) || null;
    currentUbicacionIdRef.current = nextUbicacionId;
    currentManzanaIdRef.current = '';
    currentIsUrbanizationRef.current = nextLocation?.tipo_punto === URBANIZATION_TYPE;
    setUbicacionId(nextUbicacionId);
    setManzanaId('');
    setVillaId('');
    setManzanas([]);
    setVillas([]);
    setManzanasError('');
    setVillasError('');
    manzanasRequestRef.current += 1;
    villasRequestRef.current += 1;
    setManzanasLoading(false);
    setVillasLoading(false);
    onUbicacionChange(nextUbicacionId);
    setErrors((current) => ({ ...current, ubicacion_id: '', manzana_id: '', villa_id: '' }));
  };

  const handleManzanaChange = (value) => {
    const nextManzanaId = String(value || '');
    const previousManzanaId = currentManzanaIdRef.current;
    currentManzanaIdRef.current = nextManzanaId;
    villasRequestRef.current += 1;
    setManzanaId(nextManzanaId);
    setVillaId('');
    setVillas([]);
    setVillasError('');
    setVillasLoading(false);
    setErrors((current) => ({ ...current, manzana_id: '', villa_id: '' }));
    if (isUrbanization && nextManzanaId && nextManzanaId === previousManzanaId) {
      void loadVillas(nextManzanaId);
    }
  };

  const handleVillaChange = (value) => {
    setVillaId(value);
    setErrors((current) => ({ ...current, villa_id: '' }));
  };

  const handleClose = () => {
    if (isSubmittingRef.current) return;
    setErrors(EMPTY_ERRORS);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    const nextErrors = {
      ...EMPTY_ERRORS,
      ubicacion_id: Number(ubicacionId) > 0 ? '' : 'Selecciona una Ubicación.',
      ocurrido_at: normalizedTimestamp ? '' : 'Ingresa una fecha y hora válidas.',
      detalle: normalizedDetail ? '' : 'Ingresa el detalle de la novedad.',
    };
    setErrors(nextErrors);

    if (nextErrors.ubicacion_id) ubicacionRef.current?.focus();
    else if (nextErrors.ocurrido_at) ocurridoAtRef.current?.focus();
    else if (nextErrors.detalle) detalleRef.current?.focus();
    if (Object.values(nextErrors).some(Boolean)) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = {
        ubicacion_id: Number(ubicacionId),
        ocurrido_at: normalizedTimestamp,
        detalle: normalizedDetail,
      };
      if (isUrbanization && Number(manzanaId) > 0) {
        payload.manzana_id = Number(manzanaId);
        if (Number(villaId) > 0) payload.villa_id = Number(villaId);
      }
      const result = await bitacorasService.createRegistro(payload);

      if (result.success) {
        isSubmittingRef.current = false;
        showToast(result.message || 'Bitácora registrada correctamente.', 'success');
        onSuccess();
        return;
      }

      const backendErrors = getBackendFieldErrors(result);
      if (result.status === 400) {
        setErrors((current) => ({ ...current, ...backendErrors }));
      }

      if (result.status === 403 || result.status === 404) {
        const refreshedLocations = await onReloadUbicaciones({ background: true });
        if (
          Array.isArray(refreshedLocations) &&
          !refreshedLocations.some((ubicacion) => ubicacion.id === Number(ubicacionId))
        ) {
          handleLocationChange('');
        }
      }

      if (
        (result.status === 404 || result.status === 409) &&
        currentUbicacionIdRef.current &&
        currentIsUrbanizationRef.current
      ) {
        const message = getVisibleErrorMessage(result, 'El contexto urbano dejó de ser válido.');
        const invalidField = getUrbanInvalidField(result, backendErrors);
        const selectedManzanaId = currentManzanaIdRef.current;
        if (invalidField === 'villa_id') {
          setVillaId('');
          setErrors((current) => ({ ...current, villa_id: message }));
          if (selectedManzanaId) void loadVillas(selectedManzanaId);
        } else if (invalidField === 'manzana_id' || selectedManzanaId) {
          currentManzanaIdRef.current = '';
          setManzanaId('');
          setVillaId('');
          setErrors((current) => ({ ...current, manzana_id: message, villa_id: '' }));
          if (currentUbicacionIdRef.current && currentIsUrbanizationRef.current) {
            void loadManzanas(currentUbicacionIdRef.current);
          }
        }
      }

      showToast(getVisibleErrorMessage(result, 'No se pudo registrar la Bitácora.'), 'error');
    } finally {
      if (isSubmittingRef.current) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Bitácora"
      size="lg"
      closeOnBackdrop
      initialFocusRef={ubicacionRef}
      closeButtonDisabled={isSubmitting}
      className="bitacoras-registro-modal"
    >
      <form id="bitacora-registro-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <AppModal.Header />
        <AppModal.Body>
          {locationsLoading ? (
            <div className="loading-spinner-wrap" role="status" aria-live="polite">
              <div className="loading-spinner" aria-hidden="true" />
              <span>Cargando Ubicaciones…</span>
            </div>
          ) : locationsError ? (
            <div className="bitacoras-load-state" role="alert">
              <p>{locationsError}</p>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => onReloadUbicaciones()}
              >
                Reintentar
              </button>
            </div>
          ) : ubicaciones.length === 0 ? (
            <div className="bitacoras-load-state" role="status">
              <p>No tienes Ubicaciones disponibles para registrar Bitácoras.</p>
            </div>
          ) : (
            <div className="bitacoras-registro-grid">
              <div className="form-group">
                <label htmlFor="bitacora-ubicacion">Ubicación</label>
                <select
                  ref={ubicacionRef}
                  id="bitacora-ubicacion"
                  value={ubicacionId}
                  onChange={(event) => handleLocationChange(event.target.value)}
                  required
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.ubicacion_id)}
                  aria-describedby={errors.ubicacion_id ? 'bitacora-ubicacion-error' : undefined}
                >
                  <option value="">Selecciona una Ubicación</option>
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
                {errors.ubicacion_id ? (
                  <span id="bitacora-ubicacion-error" className="field-error">
                    {errors.ubicacion_id}
                  </span>
                ) : null}
              </div>

              {isUrbanization ? (
                <div className="form-group">
                  <label htmlFor="bitacora-manzana">Manzana</label>
                  <SearchableSelect
                    ref={manzanaRef}
                    inputId="bitacora-manzana"
                    value={manzanaId}
                    onChange={handleManzanaChange}
                    options={manzanas}
                    getOptionLabel={(manzana) => manzana.nombre}
                    disabled={isSubmitting || manzanasLoading}
                    loading={manzanasLoading}
                    loadingMessage="Cargando Manzanas..."
                    placeholder="Sin Manzana"
                    emptyMessage="No hay Manzanas activas disponibles."
                    aria-invalid={Boolean(errors.manzana_id)}
                    aria-describedby={
                      [
                        errors.manzana_id || manzanasError ? 'bitacora-manzana-error' : '',
                        manzanasLoading ? 'bitacora-manzana-status' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                  />
                  {manzanasLoading ? (
                    <span
                      id="bitacora-manzana-status"
                      className="bitacoras-field-hint"
                      role="status"
                    >
                      Cargando Manzanas activas...
                    </span>
                  ) : errors.manzana_id ? (
                    <span id="bitacora-manzana-error" className="field-error">
                      {errors.manzana_id}
                    </span>
                  ) : manzanasError ? (
                    <span id="bitacora-manzana-error" className="field-error" role="alert">
                      {manzanasError}{' '}
                      <button
                        type="button"
                        className="bitacoras-inline-retry"
                        onClick={() => loadManzanas(ubicacionId)}
                        disabled={isSubmitting}
                      >
                        Reintentar
                      </button>
                    </span>
                  ) : manzanas.length === 0 ? (
                    <span className="bitacoras-field-hint">
                      No hay Manzanas activas disponibles.
                    </span>
                  ) : null}
                </div>
              ) : null}

              {isUrbanization && manzanaId ? (
                <div className="form-group">
                  <label htmlFor="bitacora-villa">Villa</label>
                  <SearchableSelect
                    ref={villaRef}
                    inputId="bitacora-villa"
                    value={villaId}
                    onChange={handleVillaChange}
                    options={villas}
                    getOptionLabel={(villa) => villa.identificador}
                    disabled={isSubmitting || villasLoading}
                    loading={villasLoading}
                    loadingMessage="Cargando Villas..."
                    placeholder="Sin Villa"
                    emptyMessage="No hay Villas activas disponibles."
                    aria-invalid={Boolean(errors.villa_id)}
                    aria-describedby={
                      [
                        errors.villa_id || villasError ? 'bitacora-villa-error' : '',
                        villasLoading ? 'bitacora-villa-status' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                  />
                  {villasLoading ? (
                    <span id="bitacora-villa-status" className="bitacoras-field-hint" role="status">
                      Cargando Villas activas…
                    </span>
                  ) : errors.villa_id ? (
                    <span id="bitacora-villa-error" className="field-error">
                      {errors.villa_id}
                    </span>
                  ) : villasError ? (
                    <span id="bitacora-villa-error" className="field-error" role="alert">
                      {villasError}{' '}
                      <button
                        type="button"
                        className="bitacoras-inline-retry"
                        onClick={() => loadVillas(manzanaId)}
                        disabled={isSubmitting}
                      >
                        Reintentar
                      </button>
                    </span>
                  ) : villas.length === 0 ? (
                    <span className="bitacoras-field-hint">No hay Villas activas disponibles.</span>
                  ) : null}
                </div>
              ) : null}

              <div className="form-group">
                <label htmlFor="bitacora-ocurrido-at">Fecha y hora</label>
                <input
                  ref={ocurridoAtRef}
                  id="bitacora-ocurrido-at"
                  type="datetime-local"
                  value={ocurridoAt}
                  onChange={(event) => {
                    setOcurridoAt(event.target.value);
                    setErrors((current) => ({ ...current, ocurrido_at: '' }));
                  }}
                  required
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.ocurrido_at)}
                  aria-describedby={errors.ocurrido_at ? 'bitacora-ocurrido-at-error' : undefined}
                />
                {errors.ocurrido_at ? (
                  <span id="bitacora-ocurrido-at-error" className="field-error">
                    {errors.ocurrido_at}
                  </span>
                ) : null}
              </div>

              <div className="form-group bitacoras-detalle-field">
                <label htmlFor="bitacora-detalle">Detalle</label>
                <textarea
                  ref={detalleRef}
                  id="bitacora-detalle"
                  value={detalle}
                  onChange={(event) => {
                    setDetalle(event.target.value);
                    setErrors((current) => ({ ...current, detalle: '' }));
                  }}
                  placeholder="Describe la novedad ocurrida"
                  required
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.detalle)}
                  aria-describedby={errors.detalle ? 'bitacora-detalle-error' : undefined}
                />
                {errors.detalle ? (
                  <span id="bitacora-detalle-error" className="field-error">
                    {errors.detalle}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'Registrando…' : 'Registrar'}
          </button>
          <button
            className="btn btn-modal-clear"
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
};

export default RegistroForm;
