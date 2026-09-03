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

const normalizeGroupEntryValue = (field, value) => {
  if (field.type === 'checkbox') {
    return Boolean(value);
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return field.type === 'number' ? Number(value) : String(value).trim();
};

const normalizeGroupEntries = (groups, groupEntries, tipoVisitaId) =>
  groups.reduce((payload, group) => {
    if (!fieldApplies(group, tipoVisitaId)) return payload;
    const entries = groupEntries[group.group_key] || [];
    if (entries.length === 0) return payload;
    payload[group.group_key] = entries.map((entry) =>
      group.fields.reduce((normalizedEntry, field) => {
        const value = normalizeGroupEntryValue(field, entry[field.field_key]);
        if (value !== undefined) normalizedEntry[field.field_key] = value;
        return normalizedEntry;
      }, {})
    );
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
  const [groupEntries, setGroupEntries] = useState({});
  const [manzanas, setManzanas] = useState([]);
  const [villas, setVillas] = useState([]);
  const [formVersion, setFormVersion] = useState(null);
  const [loading, setLoading] = useState({ manzanas: false, villas: false, form: false });
  const [loadError, setLoadError] = useState('');
  const [noActiveForm, setNoActiveForm] = useState(false);
  const [errors, setErrors] = useState({});
  const [motivoNoAutorizacion, setMotivoNoAutorizacion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locationRef = useRef(null);
  const manzanaRef = useRef(null);
  const villaRef = useRef(null);
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
  const applicableFields = useMemo(
    () => (formVersion?.fields || []).filter((field) => fieldApplies(field, fixed.tipo_visita_id)),
    [formVersion, fixed.tipo_visita_id]
  );
  const applicableGroups = useMemo(
    () => (formVersion?.groups || []).filter((group) => fieldApplies(group, fixed.tipo_visita_id)),
    [formVersion, fixed.tipo_visita_id]
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

  const addGroupEntry = (groupKey) => {
    setGroupEntries((current) => ({
      ...current,
      [groupKey]: [...(current[groupKey] || []), {}],
    }));
  };

  const removeGroupEntry = (groupKey, entryIndex) => {
    setGroupEntries((current) => ({
      ...current,
      [groupKey]: (current[groupKey] || []).filter((_, index) => index !== entryIndex),
    }));
  };

  const setGroupEntryField = (groupKey, entryIndex, fieldKey, value) => {
    setGroupEntries((current) => ({
      ...current,
      [groupKey]: (current[groupKey] || []).map((entry, index) =>
        index === entryIndex ? { ...entry, [fieldKey]: value } : entry
      ),
    }));
    setErrors((current) => ({ ...current, [`grupos.${groupKey}.${entryIndex}.${fieldKey}`]: '' }));
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
    setNoActiveForm(false);
    const result = await bitacorasService.getFormularioVisitasActivo(ubicacionId);
    if (!mountedRef.current || sequenceRef.current.form !== requestId) return;
    setLoading((current) => ({ ...current, form: false }));
    if (result.success) {
      setFormVersion(result.data);
      setResponses({});
      setGroupEntries({});
    } else if (result.status === 404) {
      // Ausencia de formulario activo es un estado normal (aún no se ha
      // publicado uno para esta Urbanización), no un error de carga.
      setFormVersion(null);
      setNoActiveForm(true);
    } else {
      setFormVersion(null);
      setLoadError(getVisibleErrorMessage(result, 'No se pudo cargar el formulario de visitas.'));
    }
  }, []);

  useEffect(() => {
    setFixed((current) => ({ ...current, manzana_id: '', villa_id: '', tipo_visita_id: '' }));
    setManzanas([]);
    setVillas([]);
    setFormVersion(null);
    setResponses({});
    setGroupEntries({});
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

  const handleSubmit = async (autorizada) => {
    if (isSubmitting) return;
    const nextErrors = {
      ubicacion_id: Number(fixed.ubicacion_id) > 0 ? '' : 'Selecciona una Urbanización.',
      manzana_id: Number(fixed.manzana_id) > 0 ? '' : 'Selecciona una Manzana.',
      villa_id: Number(fixed.villa_id) > 0 ? '' : 'Selecciona una Villa.',
      tipo_visita_id: Number(fixed.tipo_visita_id) > 0 ? '' : 'Selecciona el tipo de visita.',
      form: formVersion ? '' : 'Publica un formulario activo antes de registrar visitas.',
      motivo_no_autorizacion:
        autorizada || motivoNoAutorizacion.trim()
          ? ''
          : 'El motivo de no autorización es requerido.',
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
    formVersion?.groups?.forEach((group) => {
      if (!fieldApplies(group, fixed.tipo_visita_id)) return;
      const entries = groupEntries[group.group_key] || [];
      if (group.min_count > 0 && entries.length < group.min_count) {
        nextErrors[`grupos.${group.group_key}`] =
          `Agrega al menos ${group.min_count} registro(s) de ${group.label}.`;
        return;
      }
      entries.forEach((entry, entryIndex) => {
        group.fields.forEach((field) => {
          const value = entry[field.field_key];
          const key = `grupos.${group.group_key}.${entryIndex}.${field.field_key}`;
          if (
            field.required &&
            (field.type === 'checkbox' ? value !== true : !String(value || '').trim())
          ) {
            nextErrors[key] = `${field.label} es requerido.`;
          } else if (value && field.type === 'cedula' && !/^\d{10}$/.test(String(value))) {
            nextErrors[key] = `${field.label} debe tener 10 dígitos.`;
          } else if (value && field.type === 'placa' && !/^[A-Z0-9]{5,10}$/.test(String(value))) {
            nextErrors[key] = `${field.label} debe tener entre 5 y 10 letras o números.`;
          }
        });
      });
    });
    setErrors(nextErrors);
    if (nextErrors.ubicacion_id) locationRef.current?.focus();
    else if (nextErrors.manzana_id) manzanaRef.current?.focus();
    else if (nextErrors.villa_id) villaRef.current?.focus();
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await bitacorasService.createVisita({
      ubicacion_id: Number(fixed.ubicacion_id),
      manzana_id: Number(fixed.manzana_id),
      villa_id: Number(fixed.villa_id),
      tipo_visita_id: Number(fixed.tipo_visita_id),
      respuestas: normalizeResponses(formVersion.fields || [], responses, fixed.tipo_visita_id),
      grupos: normalizeGroupEntries(formVersion.groups || [], groupEntries, fixed.tipo_visita_id),
      autorizada,
      motivo_no_autorizacion: autorizada ? undefined : motivoNoAutorizacion.trim(),
    });
    setIsSubmitting(false);
    if (result.success) {
      showToast(
        result.message || (autorizada ? 'Visita registrada.' : 'Visita no autorizada registrada.'),
        'success'
      );
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
      <form aria-busy={isSubmitting}>
        <AppModal.Header />
        <AppModal.Body>
          <section className="bitacoras-registro-section">
            <h4 className="bitacoras-registro-section-title">Contexto</h4>
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
                {errors.manzana_id ? (
                  <span className="field-error">{errors.manzana_id}</span>
                ) : null}
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
                    {selectedVilla.residente_principal_contacto ? (
                      <>
                        {' '}
                        · <strong>{selectedVilla.residente_principal_contacto}</strong>
                      </>
                    ) : null}
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
              <div className="form-group bitacoras-field-span-2">
                <label htmlFor="visita-motivo-no-autorizacion">
                  Motivo de no autorización
                  <span className="bitacoras-field-hint"> (solo si vas a rechazar la visita)</span>
                </label>
                <textarea
                  id="visita-motivo-no-autorizacion"
                  value={motivoNoAutorizacion}
                  onChange={(event) => {
                    setMotivoNoAutorizacion(event.target.value);
                    setErrors((current) => ({ ...current, motivo_no_autorizacion: '' }));
                  }}
                  placeholder="Explica por qué no se autoriza el ingreso..."
                  rows={2}
                  maxLength={200}
                  aria-invalid={Boolean(errors.motivo_no_autorizacion)}
                />
                {errors.motivo_no_autorizacion ? (
                  <span className="field-error">{errors.motivo_no_autorizacion}</span>
                ) : null}
              </div>
              {loadError ? <p className="bitacoras-filter-error">{loadError}</p> : null}
              {noActiveForm ? (
                <p className="bitacoras-field-hint">
                  Esta Urbanización aún no tiene un formulario de visitas publicado.
                </p>
              ) : null}
              {errors.form ? <p className="bitacoras-filter-error">{errors.form}</p> : null}
              {loading.form ? <p className="bitacoras-field-hint">Cargando formulario...</p> : null}
              {formVersion?.mostrar_fecha_hora ? (
                <p className="bitacoras-field-hint">
                  La fecha y hora se registrarán automáticamente.
                </p>
              ) : null}
            </div>
          </section>

          {fixed.tipo_visita_id && applicableGroups.length > 0 ? (
            <section className="bitacoras-registro-section">
              <h4 className="bitacoras-registro-section-title">Visitantes</h4>
              {applicableGroups.map((group) => {
                const entries = groupEntries[group.group_key] || [];
                return (
                  <div className="bitacoras-registro-group" key={group.group_key}>
                    {applicableGroups.length > 1 ? <h5>{group.label}</h5> : null}
                    {errors[`grupos.${group.group_key}`] ? (
                      <span className="field-error">{errors[`grupos.${group.group_key}`]}</span>
                    ) : null}
                    {entries.length > 0 ? (
                      <div className="bitacoras-visitantes-table">
                        <div
                          className="bitacoras-visitantes-row bitacoras-visitantes-row--header"
                          aria-hidden="true"
                        >
                          {group.fields.map((field) => (
                            <span key={field.field_key}>
                              {field.label}
                              {field.required ? <span className="required"> *</span> : null}
                            </span>
                          ))}
                          <span />
                        </div>
                        {entries.map((entry, entryIndex) => (
                          <div
                            className="bitacoras-visitantes-row"
                            key={`${group.group_key}-${entryIndex}`}
                          >
                            {group.fields.map((field) => {
                              const inputId = `visita-grupo-${group.group_key}-${entryIndex}-${field.field_key}`;
                              const errorKey = `grupos.${group.group_key}.${entryIndex}.${field.field_key}`;
                              return (
                                <div className="bitacoras-visitantes-cell" key={field.field_key}>
                                  <label className="bitacoras-sr-only" htmlFor={inputId}>
                                    {field.label} {entryIndex + 1}
                                  </label>
                                  {field.type === 'textarea' ? (
                                    <textarea
                                      id={inputId}
                                      value={entry[field.field_key] || ''}
                                      onChange={(event) =>
                                        setGroupEntryField(
                                          group.group_key,
                                          entryIndex,
                                          field.field_key,
                                          event.target.value
                                        )
                                      }
                                    />
                                  ) : field.type === 'checkbox' ? (
                                    <label className="bitacoras-checkbox-field">
                                      <input
                                        id={inputId}
                                        type="checkbox"
                                        checked={Boolean(entry[field.field_key])}
                                        onChange={(event) =>
                                          setGroupEntryField(
                                            group.group_key,
                                            entryIndex,
                                            field.field_key,
                                            event.target.checked
                                          )
                                        }
                                      />
                                      Sí
                                    </label>
                                  ) : (
                                    <input
                                      id={inputId}
                                      type={field.type === 'number' ? 'number' : 'text'}
                                      value={entry[field.field_key] || ''}
                                      onChange={(event) =>
                                        setGroupEntryField(
                                          group.group_key,
                                          entryIndex,
                                          field.field_key,
                                          field.type === 'cedula'
                                            ? event.target.value.replace(/\D/g, '').slice(0, 10)
                                            : field.type === 'placa'
                                              ? event.target.value
                                                  .toUpperCase()
                                                  .replace(/[^A-Z0-9]/g, '')
                                                  .slice(0, 10)
                                              : event.target.value
                                        )
                                      }
                                      inputMode={field.type === 'cedula' ? 'numeric' : undefined}
                                      pattern={field.type === 'cedula' ? '[0-9]{10}' : undefined}
                                      maxLength={
                                        ['cedula', 'placa'].includes(field.type) ? 10 : undefined
                                      }
                                      autoCapitalize={
                                        field.type === 'placa' ? 'characters' : undefined
                                      }
                                    />
                                  )}
                                  {errors[errorKey] ? (
                                    <span className="field-error">{errors[errorKey]}</span>
                                  ) : null}
                                </div>
                              );
                            })}
                            <button
                              className="bitacoras-visitantes-remove"
                              type="button"
                              title={`Eliminar ${group.label} ${entryIndex + 1}`}
                              aria-label={`Eliminar ${group.label} ${entryIndex + 1}`}
                              onClick={() => removeGroupEntry(group.group_key, entryIndex)}
                              disabled={isSubmitting}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <button
                      className="btn btn-secondary btn-sm bitacoras-add-entry"
                      type="button"
                      onClick={() => addGroupEntry(group.group_key)}
                      disabled={isSubmitting}
                    >
                      + Agregar {group.label}
                    </button>
                  </div>
                );
              })}
            </section>
          ) : null}

          {fixed.tipo_visita_id && applicableFields.length > 0 ? (
            <section className="bitacoras-registro-section">
              <h4 className="bitacoras-registro-section-title">Preguntas</h4>
              <div className="bitacoras-registro-grid">
                {applicableFields.map((field) => (
                  <div
                    className={`form-group${field.type === 'textarea' ? ' bitacoras-field-span-2' : ''}`}
                    key={field.field_key}
                  >
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
                      <span className="field-error">{errors[`respuestas.${field.field_key}`]}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registrando...' : 'Visita autorizada'}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registrando...' : 'No autorizada'}
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
