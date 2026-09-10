const { hasPermission, PERMISSIONS } = require('../../config/permissions');
const { createHttpError, parsePositiveInteger } = require('../../utils/http');
const { isValidDateString } = require('../../utils/inputValidation');

const BITACORA_STATES = new Set(['REGISTRADA', 'ANULADA']);
const URBAN_CONTEXT_CONSTRAINTS = new Set([
  'bitacora_registros_villa_requiere_manzana_check',
  'bitacora_registros_manzana_ubicacion_fkey',
  'bitacora_registros_villa_manzana_fkey',
]);
const HISTORY_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'ubicacion_id',
  'fecha_desde',
  'fecha_hasta',
  'estado',
  'autor',
  'sortBy',
  'sortOrder',
]);
const VISIT_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'estado',
  'ubicacion_id',
  'creator',
  'fecha_desde',
  'fecha_hasta',
  'search',
  'sortBy',
  'sortOrder',
]);
const VISIT_STATES = new Set(['ABIERTA', 'CERRADA', 'ANULADA', 'NO_AUTORIZADA']);
const VISIT_FORM_STATES = new Set(['ACTIVE', 'ARCHIVED']);
const VISIT_FORM_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'nombre',
  'ubicacion_id',
  'creator',
  'estado',
  'sortBy',
  'sortOrder',
]);
const HISTORY_SORTS = {
  ocurrido_at: 'br.ocurrido_at',
  ubicacion: 'u.nombre',
  casa: String.raw`COALESCE(bv.manzana_texto, m.nombre, '') || COALESCE(bv.villa_texto, v.identificador, '')`,
  autor: 'c.nombres_completos',
  detalle: 'br.detalle',
};
const VISIT_SORTS = {
  tipo_visita: 'tv.nombre',
  placa: 'bv.placa',
  casa: String.raw`COALESCE(m.nombre, '') || COALESCE(v.identificador, '')`,
  titular: 'r.nombre',
  registrado_por: 'u.usuario',
  salida_at: 'bv.salida_at',
  estado: 'bv.estado',
  observacion: 'bv.motivo_no_autorizacion',
  entrada_at: 'bv.entrada_at',
};
const VISIT_FORM_SORTS = {
  nombre: 'bfv.titulo',
  ubicacion: 'u.nombre',
  version: 'bfv.version',
  estado: 'bfv.estado',
  creador: 'creator.usuario',
  published_at: 'bfv.published_at',
};

const hasGlobalLocationScope = (tipoUsuario) =>
  hasPermission(tipoUsuario, PERMISSIONS.BITACORAS_PUNTOS_VER_TODOS);

const domainError = (status, code, message) => {
  const error = createHttpError(status, message);
  error.appCode = code;
  return error;
};

const normalizeHistoryFilters = (query = {}) => {
  const unknownFields = Object.keys(query).filter((field) => !HISTORY_QUERY_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw createHttpError(400, `Filtro no permitido: ${unknownFields[0]}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const ubicacionId = query.ubicacion_id
    ? parsePositiveInteger(query.ubicacion_id, 'El filtro ubicación es inválido')
    : undefined;
  const fechaDesde = query.fecha_desde || undefined;
  const fechaHasta = query.fecha_hasta || undefined;
  const estado = query.estado || undefined;
  if (query.autor !== undefined && typeof query.autor !== 'string') {
    throw createHttpError(400, 'autor debe ser texto');
  }
  const autor = query.autor?.trim() || undefined;

  if (fechaDesde && !isValidDateString(fechaDesde)) {
    throw createHttpError(400, 'fecha_desde debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaHasta && !isValidDateString(fechaHasta)) {
    throw createHttpError(400, 'fecha_hasta debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw createHttpError(400, 'El rango de fechas es inválido');
  }
  if (estado && !BITACORA_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser REGISTRADA o ANULADA');
  }
  if (autor && autor.length > 100) {
    throw createHttpError(400, 'autor no puede exceder 100 caracteres');
  }

  return { ubicacionId, fechaDesde, fechaHasta, estado, autor };
};

const normalizeVisitFilters = (query = {}) => {
  const unknownFields = Object.keys(query).filter((field) => !VISIT_QUERY_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw createHttpError(400, `Filtro no permitido: ${unknownFields[0]}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const estado = query.estado || undefined;
  if (estado && !VISIT_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser ABIERTA, CERRADA, ANULADA o NO_AUTORIZADA');
  }
  const ubicacionId = query.ubicacion_id
    ? parsePositiveInteger(query.ubicacion_id, 'La Urbanización es inválida')
    : undefined;
  const fechaDesde = query.fecha_desde || undefined;
  const fechaHasta = query.fecha_hasta || undefined;
  if (fechaDesde && !isValidDateString(fechaDesde)) {
    throw createHttpError(400, 'fecha_desde debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaHasta && !isValidDateString(fechaHasta)) {
    throw createHttpError(400, 'fecha_hasta debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw createHttpError(400, 'El rango de fechas es inválido');
  }
  const textFilter = (value, field) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw createHttpError(400, `${field} debe ser texto`);
    }
    const trimmed = value.trim();
    if (trimmed.length > 100) {
      throw createHttpError(400, `${field} no puede exceder 100 caracteres`);
    }
    return trimmed || undefined;
  };
  return {
    estado,
    ubicacionId,
    fechaDesde,
    fechaHasta,
    creator: textFilter(query.creator, 'creator'),
    search: textFilter(query.search, 'search'),
  };
};

const normalizeVisitFormFilters = (query = {}) => {
  const unknownField = Object.keys(query).find((field) => !VISIT_FORM_QUERY_FIELDS.has(field));
  if (unknownField) {
    throw createHttpError(400, `Filtro no permitido: ${unknownField}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const normalizeTextFilter = (value, field) => {
    const normalized = value?.trim() || undefined;
    if (normalized && normalized.length > 100) {
      throw createHttpError(400, `${field} no puede exceder 100 caracteres`);
    }
    return normalized;
  };
  const locationId = query.ubicacion_id
    ? parsePositiveInteger(query.ubicacion_id, 'La Urbanización es inválida')
    : undefined;
  const estado = query.estado || undefined;
  if (estado && !VISIT_FORM_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser ACTIVE o ARCHIVED');
  }
  return {
    nombre: normalizeTextFilter(query.nombre, 'nombre'),
    creator: normalizeTextFilter(query.creator, 'creator'),
    locationId,
    estado,
  };
};

const respondError = (code, message, detailKey) => {
  const error = domainError(400, code, message);
  error.details = { [detailKey]: [message] };
  return error;
};

// Validates and normalizes a single field's raw answer against its type/required
// rules. Returns `undefined` for an intentionally-empty optional answer, or the
// normalized value to persist. Shared by scalar fields and group-member fields
// (each person entry inside a repeatable group answers the same field shapes).
const validateFieldAnswer = (field, rawValue, detailKey) => {
  const missing = rawValue === undefined || rawValue === null || rawValue === '';
  if (field.required && (missing || (field.type === 'checkbox' && rawValue !== true))) {
    throw respondError('VISIT_RESPONSE_REQUIRED', `${field.label} es requerido`, detailKey);
  }
  if (missing) {
    return undefined;
  }

  if (field.type === 'checkbox') {
    if (typeof rawValue !== 'boolean') {
      throw respondError('VISIT_RESPONSE_INVALID', `${field.label} debe ser sí/no`, detailKey);
    }
    return rawValue;
  }
  if (field.type === 'photo') {
    if (
      typeof rawValue !== 'string' ||
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(rawValue) ||
      rawValue.length > 800000
    ) {
      throw respondError(
        'VISIT_RESPONSE_INVALID',
        `${field.label} debe ser una imagen válida de máximo 600 KB`,
        detailKey
      );
    }
    return rawValue;
  }
  const stringValue = String(rawValue).trim();
  if (!stringValue && field.required) {
    throw respondError('VISIT_RESPONSE_REQUIRED', `${field.label} es requerido`, detailKey);
  }
  if (!stringValue) {
    return undefined;
  }
  if (field.type === 'number' && !Number.isFinite(Number(stringValue))) {
    throw respondError('VISIT_RESPONSE_INVALID', `${field.label} debe ser numérico`, detailKey);
  }
  if (field.type === 'cedula' && (typeof rawValue !== 'string' || !/^\d{10}$/.test(stringValue))) {
    throw respondError('VISIT_RESPONSE_INVALID', `${field.label} debe tener 10 dígitos`, detailKey);
  }
  const normalizedPlate =
    field.type === 'placa' && typeof rawValue === 'string'
      ? stringValue.toUpperCase().replace(/[^A-Z0-9]/g, '')
      : stringValue;
  if (
    field.type === 'placa' &&
    (typeof rawValue !== 'string' || !/^[A-Z0-9]{5,10}$/.test(normalizedPlate))
  ) {
    throw respondError(
      'VISIT_RESPONSE_INVALID',
      `${field.label} debe tener entre 5 y 10 letras o números`,
      detailKey
    );
  }
  if (field.type === 'select') {
    const options = Array.isArray(field.options) ? field.options : [];
    if (!options.includes(stringValue)) {
      throw respondError(
        'VISIT_RESPONSE_INVALID',
        `${field.label} no es una opción válida`,
        detailKey
      );
    }
  }
  return field.type === 'number'
    ? Number(stringValue)
    : field.type === 'placa'
      ? normalizedPlate
      : stringValue;
};

const fieldAppliesToTipo = (field, tipoVisitaId) =>
  !field.aplica_a ||
  field.aplica_a === 'TODOS' ||
  (Array.isArray(field.tipos) && field.tipos.includes(tipoVisitaId));

const validateVisitResponses = (fields, responses = {}, tipoVisitaId) => {
  const allowedKeys = new Set(fields.map((field) => field.field_key));
  const unknownKey = Object.keys(responses).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    const error = domainError(
      400,
      'VISIT_RESPONSE_FIELD_NOT_ALLOWED',
      'Campo de visita no permitido'
    );
    error.details = { respuestas: [`Campo no permitido: ${unknownKey}`] };
    throw error;
  }

  const normalized = {};
  fields.forEach((field) => {
    const rawValue = responses[field.field_key];
    const detailKey = `respuestas.${field.field_key}`;
    if (!fieldAppliesToTipo(field, tipoVisitaId)) {
      if (rawValue !== undefined) {
        throw respondError(
          'VISIT_RESPONSE_NOT_APPLICABLE',
          `${field.label} no aplica al tipo de ingreso`,
          detailKey
        );
      }
      return;
    }
    const value = validateFieldAnswer(field, rawValue, detailKey);
    if (value !== undefined) {
      normalized[field.field_key] = value;
    }
  });
  return normalized;
};

// Validates the repeatable-group entries submitted for a visit: applicability
// per tipo, minimum entry count, and per-entry/per-field required+type rules
// (via validateFieldAnswer). Returns a normalized { [group_key]: entry[] } map
// ready to persist, mirroring validateVisitResponses's normalized output.
const validateVisitGroupResponses = (groups, groupResponses = {}, tipoVisitaId) => {
  const allowedKeys = new Set(groups.map((group) => group.group_key));
  const unknownKey = Object.keys(groupResponses).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    const error = domainError(400, 'VISIT_GROUP_NOT_ALLOWED', 'Grupo de visita no permitido');
    error.details = { grupos: [`Grupo no permitido: ${unknownKey}`] };
    throw error;
  }

  const normalized = {};
  groups.forEach((group) => {
    const entries = Array.isArray(groupResponses[group.group_key])
      ? groupResponses[group.group_key]
      : [];
    const applies = fieldAppliesToTipo(group, tipoVisitaId);
    if (!applies) {
      if (entries.length > 0) {
        throw respondError(
          'VISIT_GROUP_NOT_APPLICABLE',
          `${group.label} no aplica al tipo de ingreso`,
          `grupos.${group.group_key}`
        );
      }
      return;
    }
    if (group.min_count > 0 && entries.length < group.min_count) {
      throw respondError(
        'VISIT_GROUP_MIN_COUNT',
        `${group.label} requiere al menos ${group.min_count} registro(s)`,
        `grupos.${group.group_key}`
      );
    }

    const allowedFieldKeys = new Set(group.fields.map((field) => field.field_key));
    normalized[group.group_key] = entries.map((entry, entryIndex) => {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw respondError(
          'VISIT_GROUP_INVALID',
          `${group.label} #${entryIndex + 1} tiene un formato inválido`,
          `grupos.${group.group_key}.${entryIndex}`
        );
      }
      const unknownFieldKey = Object.keys(entry).find((key) => !allowedFieldKeys.has(key));
      if (unknownFieldKey) {
        throw respondError(
          'VISIT_GROUP_FIELD_NOT_ALLOWED',
          `Campo no permitido en ${group.label}: ${unknownFieldKey}`,
          `grupos.${group.group_key}.${entryIndex}`
        );
      }
      const normalizedEntry = {};
      group.fields.forEach((field) => {
        const value = validateFieldAnswer(
          field,
          entry[field.field_key],
          `grupos.${group.group_key}.${entryIndex}.${field.field_key}`
        );
        if (value !== undefined) {
          normalizedEntry[field.field_key] = value;
        }
      });
      return normalizedEntry;
    });
  });
  return normalized;
};

const visitDetail = ({ action, visitorName, tipoVisitaNombre, plate, house }) => {
  const access = plate ? `${tipoVisitaNombre} · Placa ${plate}` : tipoVisitaNombre;
  return `${action} visita: ${visitorName || 'Visitante'} · ${access} · Casa ${house}`;
};

module.exports = {
  BITACORA_STATES,
  URBAN_CONTEXT_CONSTRAINTS,
  HISTORY_QUERY_FIELDS,
  VISIT_QUERY_FIELDS,
  VISIT_STATES,
  VISIT_FORM_STATES,
  VISIT_FORM_QUERY_FIELDS,
  HISTORY_SORTS,
  VISIT_SORTS,
  VISIT_FORM_SORTS,
  hasGlobalLocationScope,
  domainError,
  normalizeHistoryFilters,
  normalizeVisitFilters,
  normalizeVisitFormFilters,
  respondError,
  validateFieldAnswer,
  fieldAppliesToTipo,
  validateVisitResponses,
  validateVisitGroupResponses,
  visitDetail,
};
