import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../../../components/AppModal';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import bitacorasService from '../../../services/bitacorasService';
import { getLocalDateTimeValue, normalizeLocalDateTimeForPayload } from '../utils/bitacorasHelpers';

const EMPTY_ERRORS = { ubicacion_id: '', ocurrido_at: '', detalle: '' };

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
  const [ocurridoAt, setOcurridoAt] = useState(() => getLocalDateTimeValue());
  const [detalle, setDetalle] = useState('');
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const ubicacionRef = useRef(null);
  const ocurridoAtRef = useRef(null);
  const detalleRef = useRef(null);

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
    const hasValidInitial = ubicaciones.some(
      (ubicacion) => String(ubicacion.id) === String(initialUbicacionId)
    );
    if (ubicaciones.length !== 1 || hasValidInitial) return;
    const onlyLocationId = String(ubicaciones[0].id);
    if (ubicacionId !== onlyLocationId) setUbicacionId(onlyLocationId);
    onUbicacionChange(onlyLocationId);
  }, [initialUbicacionId, onUbicacionChange, ubicacionId, ubicaciones]);

  useEffect(() => {
    if (errors.ubicacion_id) ubicacionRef.current?.focus();
    else if (errors.ocurrido_at) ocurridoAtRef.current?.focus();
    else if (errors.detalle) detalleRef.current?.focus();
  }, [errors]);

  const handleLocationChange = (value) => {
    setUbicacionId(value);
    onUbicacionChange(value);
    setErrors((current) => ({ ...current, ubicacion_id: '' }));
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
      const result = await bitacorasService.createRegistro({
        ubicacion_id: Number(ubicacionId),
        ocurrido_at: normalizedTimestamp,
        detalle: normalizedDetail,
      });

      if (result.success) {
        isSubmittingRef.current = false;
        showToast(result.message || 'Bitácora registrada correctamente.', 'success');
        onSuccess();
        return;
      }

      if (result.status === 400) {
        const backendErrors = getBackendFieldErrors(result);
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
