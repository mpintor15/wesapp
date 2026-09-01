import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../../../components/AppModal';
import SearchableSelect from '../../../components/SearchableSelect';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import bitacorasService from '../../../services/bitacorasService';

const EMPTY_FIXED = {
  ubicacion_id: '',
  manzana_id: '',
  villa_id: '',
  tipo_visita_id: '',
  visitante_nombre: '',
  visitante_documento: '',
  visitante_telefono: '',
  placa: '',
};

const URBANIZATION_TYPE = 'URBANIZACION';

const fieldApplies = (field, tipoVisitaId) =>
  !field.aplica_a ||
  field.aplica_a === 'TODOS' ||
  (Array.isArray(field.tipos) && field.tipos.includes(Number(tipoVisitaId)));

const normalizeResponses = (fields, responses, tipoVisitaId) =>
  fields.reduce((payload, field) => {
    if (!fieldApplies(field, tipoVisitaId)) return payload;
    const value = responses[field.field_key];
    if (field.type === 'checkbox') {
      payload[field.field_key] = Boolean(value);
    } else if (value !== undefined && value !== null && String(value).trim() !== '') {
      payload[field.field_key] = field.type === 'number' ? Number(value) : String(value).trim();
    }
    return payload;
  }, {});

const getInitialLocationId = (locations) => {
  const urbanLocations = locations.filter((location) => location.tipo_punto === URBANIZATION_TYPE);
  return urbanLocations.length === 1 ? String(urbanLocations[0].id) : '';
};

const VisitaForm = ({ isOpen, ubicaciones, onClose, onSuccess, showToast }) => {
  const [fixed, setFixed] = useState(() => ({
    ...EMPTY_FIXED,
    ubicacion_id: getInitialLocationId(ubicaciones),
  }));
  const [responses, setResponses] = useState({});
  const [manzanas, setManzanas] = useState([]);
  const [villas, setVillas] = useState([]);
  const [formVersion, setFormVersion] = useState(null);
  const [loading, setLoading] = useState({ manzanas: false, villas: false, form: false });
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locationRef = useRef(null);
  const manzanaRef = useRef(null);
  const villaRef = useRef(null);
  const visitorRef = useRef(null);
  const documentRef = useRef(null);
  const sequenceRef = useRef({ manzanas: 0, villas: 0, form: 0 });
  const mountedRef = useRef(false);

  const urbanLocations = useMemo(
    () => ubicaciones.filter((location) => location.tipo_punto === URBANIZATION_TYPE),
    [ubicaciones]
  );
  const selectedVilla = useMemo(
    () => villas.find((villa) => String(villa.id) === String(fixed.villa_id)) || null,
    [fixed.villa_id, villas]
  );

  useEffect(() => {
    const sequence = sequenceRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequence.manzanas += 1;
      sequence.villas += 1;
      sequence.form += 1;
    };
  }, []);

  const setField = (field, value) => {
    setFixed((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const loadManzanas = useCallback(async (ubicacionId) => {
    if (!ubicacionId) return;
    const requestId = sequenceRef.current.manzanas + 1;
    sequenceRef.current.manzanas = requestId;
    setLoading((current) => ({ ...current, manzanas: true }));
    setLoadError('');
    const result = await bitacorasService.getManzanas(ubicacionId);
    if (!mountedRef.current || sequenceRef.current.manzanas !== requestId) return;
    setLoading((current) => ({ ...current, manzanas: false }));
    if (result.success) setManzanas(Array.isArray(result.data) ? result.data : []);
    else {
      setManzanas([]);
      setLoadError(getVisibleErrorMessage(result, 'No se pudieron cargar las Manzanas.'));
    }
  }, []);

  const loadVillas = useCallback(async (manzanaId) => {
    if (!manzanaId) return;
    const requestId = sequenceRef.current.villas + 1;
    sequenceRef.current.villas = requestId;
    setLoading((current) => ({ ...current, villas: true }));
    setLoadError('');
    const result = await bitacorasService.getVillas(manzanaId);
    if (!mountedRef.current || sequenceRef.current.villas !== requestId) return;
    setLoading((current) => ({ ...current, villas: false }));
    if (result.success) setVillas(Array.isArray(result.data) ? result.data : []);
    else {
      setVillas([]);
      setLoadError(getVisibleErrorMessage(result, 'No se pudieron cargar las Villas.'));
    }
  }, []);

  const loadForm = useCallback(async (ubicacionId) => {
    if (!ubicacionId) return;
    const requestId = sequenceRef.current.form + 1;
    sequenceRef.current.form = requestId;
    setLoading((current) => ({ ...current, form: true }));
    setLoadError('');
    const result = await bitacorasService.getFormularioVisitasActivo(ubicacionId);
    if (!mountedRef.current || sequenceRef.current.form !== requestId) return;
    setLoading((current) => ({ ...current, form: false }));
    if (result.success) {
      setFormVersion(result.data);
      setResponses({});
    } else {
      setFormVersion(null);
      setLoadError(getVisibleErrorMessage(result, 'La Urbanización no tiene formulario activo.'));
    }
  }, []);

  useEffect(() => {
    setFixed((current) => ({ ...current, manzana_id: '', villa_id: '', tipo_visita_id: '' }));
    setManzanas([]);
    setVillas([]);
    setFormVersion(null);
    setResponses({});
    sequenceRef.current.manzanas += 1;
    sequenceRef.current.villas += 1;
    sequenceRef.current.form += 1;
    setLoading({ manzanas: false, villas: false, form: false });
    if (fixed.ubicacion_id) {
      void loadManzanas(fixed.ubicacion_id);
      void loadForm(fixed.ubicacion_id);
    }
  }, [fixed.ubicacion_id, loadForm, loadManzanas]);

  useEffect(() => {
    setFixed((current) => ({ ...current, villa_id: '' }));
    setVillas([]);
    sequenceRef.current.villas += 1;
    setLoading((current) => ({ ...current, villas: false }));
    if (fixed.manzana_id) void loadVillas(fixed.manzana_id);
  }, [fixed.manzana_id, loadVillas]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = {
      ubicacion_id: Number(fixed.ubicacion_id) > 0 ? '' : 'Selecciona una Urbanización.',
      manzana_id: Number(fixed.manzana_id) > 0 ? '' : 'Selecciona una Manzana.',
      villa_id: Number(fixed.villa_id) > 0 ? '' : 'Selecciona una Villa.',
      visitante_nombre: fixed.visitante_nombre.trim() ? '' : 'Ingresa el nombre.',
      visitante_documento: /^\d{10}$/.test(fixed.visitante_documento)
        ? ''
        : 'Ingresa una Cédula de exactamente 10 dígitos.',
      visitante_telefono: fixed.visitante_telefono.trim() ? '' : 'Ingresa el teléfono.',
      tipo_visita_id: Number(fixed.tipo_visita_id) > 0 ? '' : 'Selecciona el tipo de visita.',
      form: formVersion ? '' : 'Publica un formulario activo antes de registrar visitas.',
    };
    formVersion?.fields?.forEach((field) => {
      if (!fieldApplies(field, fixed.tipo_visita_id)) return;
      const value = responses[field.field_key];
      if (
        field.required &&
        (field.type === 'checkbox' ? value !== true : !String(value || '').trim())
      ) {
        nextErrors[`respuestas.${field.field_key}`] = `${field.label} es requerido.`;
      } else if (value && field.type === 'cedula' && !/^\d{10}$/.test(String(value))) {
        nextErrors[`respuestas.${field.field_key}`] = `${field.label} debe tener 10 dígitos.`;
      } else if (value && field.type === 'placa' && !/^[A-Z0-9]{5,10}$/.test(String(value))) {
        nextErrors[`respuestas.${field.field_key}`] =
          `${field.label} debe tener entre 5 y 10 letras o números.`;
      }
    });
    setErrors(nextErrors);
    if (nextErrors.ubicacion_id) locationRef.current?.focus();
    else if (nextErrors.manzana_id) manzanaRef.current?.focus();
    else if (nextErrors.villa_id) villaRef.current?.focus();
    else if (nextErrors.visitante_nombre) visitorRef.current?.focus();
    else if (nextErrors.visitante_documento) documentRef.current?.focus();
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await bitacorasService.createVisita({
      ...fixed,
      ubicacion_id: Number(fixed.ubicacion_id),
      manzana_id: Number(fixed.manzana_id),
      villa_id: Number(fixed.villa_id),
      visitante_nombre: fixed.visitante_nombre.trim(),
      visitante_documento: fixed.visitante_documento.trim(),
      visitante_telefono: fixed.visitante_telefono.trim(),
      tipo_visita_id: Number(fixed.tipo_visita_id),
      placa: fixed.placa.trim() ? fixed.placa.trim().toUpperCase() : undefined,
      respuestas: normalizeResponses(formVersion.fields || [], responses, fixed.tipo_visita_id),
    });
    setIsSubmitting(false);
    if (result.success) {
      showToast(result.message || 'Visita registrada.', 'success');
      onSuccess();
      return;
    }
    showToast(getVisibleErrorMessage(result, 'No se pudo registrar la visita.'), 'error');
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Visita"
      size="lg"
      closeOnBackdrop
      className="bitacoras-registro-modal"
    >
      <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <AppModal.Header />
        <AppModal.Body>
          <div className="bitacoras-registro-grid">
            <div className="form-group">
              <label htmlFor="visita-ubicacion">Urbanización</label>
              <select
                ref={locationRef}
                id="visita-ubicacion"
                value={fixed.ubicacion_id}
                onChange={(event) => setField('ubicacion_id', event.target.value)}
                aria-invalid={Boolean(errors.ubicacion_id)}
              >
                <option value="">Selecciona una Urbanización</option>
                {urbanLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.nombre}
                  </option>
                ))}
              </select>
              {errors.ubicacion_id ? (
                <span className="field-error">{errors.ubicacion_id}</span>
              ) : null}
            </div>
            <div className="form-group">
              <label htmlFor="visita-manzana">Manzana</label>
              <SearchableSelect
                ref={manzanaRef}
                inputId="visita-manzana"
                value={fixed.manzana_id}
                onChange={(value) => setField('manzana_id', value)}
                options={manzanas}
                getOptionLabel={(manzana) => manzana.nombre}
                loading={loading.manzanas}
                disabled={!fixed.ubicacion_id || loading.manzanas}
                placeholder="Selecciona una Manzana"
                aria-invalid={Boolean(errors.manzana_id)}
              />
              {errors.manzana_id ? <span className="field-error">{errors.manzana_id}</span> : null}
            </div>
            <div className="form-group">
              <label htmlFor="visita-villa">Villa</label>
              <SearchableSelect
                ref={villaRef}
                inputId="visita-villa"
                value={fixed.villa_id}
                onChange={(value) => setField('villa_id', value)}
                options={villas}
                getOptionLabel={(villa) => villa.identificador}
                loading={loading.villas}
                disabled={!fixed.manzana_id || loading.villas}
                placeholder="Selecciona una Villa"
                aria-invalid={Boolean(errors.villa_id)}
              />
              {errors.villa_id ? <span className="field-error">{errors.villa_id}</span> : null}
              {selectedVilla ? (
                <span className="bitacoras-resident-summary">
                  Titular: <strong>{selectedVilla.residente_principal_nombre}</strong>
                </span>
              ) : null}
            </div>
            <div className="form-group">
              <label htmlFor="visita-tipo-visita">Tipo de visita</label>
              <select
                id="visita-tipo-visita"
                value={fixed.tipo_visita_id}
                onChange={(event) => setField('tipo_visita_id', event.target.value)}
                aria-invalid={Boolean(errors.tipo_visita_id)}
                disabled={!formVersion}
              >
                <option value="">Selecciona un tipo de visita</option>
                {(formVersion?.tipos || []).map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
              {errors.tipo_visita_id ? (
                <span className="field-error">{errors.tipo_visita_id}</span>
              ) : null}
            </div>
            {['visitante_nombre', 'visitante_documento', 'visitante_telefono', 'placa'].map(
              (field) => (
                <div className="form-group" key={field}>
                  <label htmlFor={`visita-${field}`}>
                    {
                      {
                        visitante_nombre: 'Visitante',
                        visitante_documento: 'Cédula',
                        visitante_telefono: 'Teléfono',
                        placa: 'Placa (opcional)',
                      }[field]
                    }
                  </label>
                  <input
                    ref={
                      field === 'visitante_nombre'
                        ? visitorRef
                        : field === 'visitante_documento'
                          ? documentRef
                          : undefined
                    }
                    id={`visita-${field}`}
                    value={fixed[field]}
                    onChange={(event) =>
                      setField(
                        field,
                        field === 'visitante_documento'
                          ? event.target.value.replace(/\D/g, '').slice(0, 10)
                          : field === 'placa'
                            ? event.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, '')
                                .slice(0, 10)
                            : event.target.value
                      )
                    }
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={errors[field] ? `visita-${field}-error` : undefined}
                    inputMode={field === 'visitante_documento' ? 'numeric' : undefined}
                    pattern={field === 'visitante_documento' ? '[0-9]{10}' : undefined}
                    maxLength={['visitante_documento', 'placa'].includes(field) ? 10 : undefined}
                    autoCapitalize={field === 'placa' ? 'characters' : undefined}
                  />
                  {errors[field] ? (
                    <span className="field-error" id={`visita-${field}-error`}>
                      {errors[field]}
                    </span>
                  ) : null}
                </div>
              )
            )}
            {loadError ? <p className="bitacoras-filter-error">{loadError}</p> : null}
            {errors.form ? <p className="bitacoras-filter-error">{errors.form}</p> : null}
            {loading.form ? <p className="bitacoras-field-hint">Cargando formulario...</p> : null}
            {formVersion?.mostrar_fecha_hora ? (
              <p className="bitacoras-field-hint">
                La fecha y hora se registrarán automáticamente.
              </p>
            ) : null}
            {fixed.tipo_visita_id
              ? formVersion?.fields
                  ?.filter((field) => fieldApplies(field, fixed.tipo_visita_id))
                  .map((field) => (
                    <div className="form-group" key={field.field_key}>
                      <label htmlFor={`visita-respuesta-${field.field_key}`}>
                        {field.label}
                        {field.required ? <span className="required"> *</span> : null}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          id={`visita-respuesta-${field.field_key}`}
                          value={responses[field.field_key] || ''}
                          onChange={(event) =>
                            setResponses((current) => ({
                              ...current,
                              [field.field_key]: event.target.value,
                            }))
                          }
                        />
                      ) : field.type === 'select' ? (
                        <select
                          id={`visita-respuesta-${field.field_key}`}
                          value={responses[field.field_key] || ''}
                          onChange={(event) =>
                            setResponses((current) => ({
                              ...current,
                              [field.field_key]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona</option>
                          {(field.options || []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <label className="bitacoras-checkbox-field">
                          <input
                            id={`visita-respuesta-${field.field_key}`}
                            type="checkbox"
                            checked={Boolean(responses[field.field_key])}
                            onChange={(event) =>
                              setResponses((current) => ({
                                ...current,
                                [field.field_key]: event.target.checked,
                              }))
                            }
                          />
                          Sí
                        </label>
                      ) : (
                        <input
                          id={`visita-respuesta-${field.field_key}`}
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={responses[field.field_key] || ''}
                          onChange={(event) =>
                            setResponses((current) => ({
                              ...current,
                              [field.field_key]:
                                field.type === 'cedula'
                                  ? event.target.value.replace(/\D/g, '').slice(0, 10)
                                  : field.type === 'placa'
                                    ? event.target.value
                                        .toUpperCase()
                                        .replace(/[^A-Z0-9]/g, '')
                                        .slice(0, 10)
                                    : event.target.value,
                            }))
                          }
                          inputMode={field.type === 'cedula' ? 'numeric' : undefined}
                          pattern={field.type === 'cedula' ? '[0-9]{10}' : undefined}
                          maxLength={['cedula', 'placa'].includes(field.type) ? 10 : undefined}
                          autoCapitalize={field.type === 'placa' ? 'characters' : undefined}
                        />
                      )}
                      {errors[`respuestas.${field.field_key}`] ? (
                        <span className="field-error">
                          {errors[`respuestas.${field.field_key}`]}
                        </span>
                      ) : null}
                    </div>
                  ))
              : null}
          </div>
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Registrar ingreso'}
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
      </form>
    </AppModal>
  );
};

export default VisitaForm;
