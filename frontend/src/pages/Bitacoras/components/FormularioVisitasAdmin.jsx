import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../../../components/AppModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import PaginationControls from '../../../components/PaginationControls';
import TabularWorkspace from '../../../components/TabularWorkspace';
import bitacorasService from '../../../services/bitacorasService';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import SortHeader from '../../Cuentas/components/SortHeader';
import { formatLocalTimestamp } from '../utils/bitacorasHelpers';

const FIELD_TYPES = [
  ['text', 'Texto', 'Respuesta corta en una sola línea.'],
  ['textarea', 'Texto largo', 'Respuesta amplia en varias líneas.'],
  ['number', 'Número', 'Acepta únicamente valores numéricos.'],
  ['select', 'Lista', 'Permite elegir una opción definida.'],
  ['checkbox', 'Casilla', 'Confirmación de sí o no.'],
  ['cedula', 'Cédula', 'Acepta exactamente 10 dígitos numéricos.'],
  ['placa', 'Placa', 'Acepta entre 5 y 10 letras o números.'],
];
const EMPTY_FILTERS = { nombre: '', ubicacion_id: '', creator: '', estado: '' };
const PAGE_SIZE = 20;

let draftFieldId = 0;
const newField = (field = {}) => ({
  draftId: ++draftFieldId,
  label: field.label || '',
  type: field.type || 'text',
  required: Boolean(field.required),
  aplica_a:
    field.aplica_a === 'TODOS' || field.aplica_a === undefined
      ? 'TODOS'
      : Array.isArray(field.aplica_a)
        ? [...field.aplica_a]
        : [],
  options: Array.isArray(field.options) ? [...field.options] : [],
  optionDraft: '',
});

const newTipoVisita = (tipo = {}) => ({
  nombre: tipo.nombre || '',
  requiereSalida: tipo.requiere_salida === true,
});

const resolveFieldForDraft = (field, tiposById) => {
  if (field.aplica_a === 'TODOS' || !Array.isArray(field.tipos)) {
    return newField(field);
  }
  return newField({
    ...field,
    aplica_a: field.tipos.map((tipoId) => tiposById.get(tipoId)).filter(Boolean),
  });
};

const normalizeFieldKey = (label) => {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
  return /^[a-z]/.test(normalized) ? normalized : `campo_${normalized || 'sin_nombre'}`;
};

const buildApiFields = (fields) => {
  const usedKeys = new Map();
  return fields
    .filter((field) => field.label.trim())
    .map((field) => {
      const baseKey = normalizeFieldKey(field.label.trim());
      const occurrence = (usedKeys.get(baseKey) || 0) + 1;
      usedKeys.set(baseKey, occurrence);
      return {
        field_key: occurrence === 1 ? baseKey : `${baseKey}_${occurrence}`,
        label: field.label.trim(),
        type: field.type,
        required: Boolean(field.required),
        aplica_a: field.aplica_a,
        options: field.type === 'select' ? field.options : [],
      };
    });
};

// "Visitantes" es una estructura predefinida, no un grupo genérico: sus dos
// campos internos (Nombre, Cédula) son fijos —no se pueden agregar, quitar
// ni retipar— y solo aplica_a/mínimo/requerido son configurables. Esto
// evita volver a pedir esos mismos datos como preguntas normales sueltas
// (ver deduplicación en handlePublish y en el backend).
const VISITANTES_GROUP_KEY = 'visitantes';
const VISITANTES_GROUP_LABEL = 'Visitantes';
const VISITANTES_FIELD_TEMPLATES = [
  {
    field_key: 'nombre',
    label: 'Nombre',
    type: 'text',
    hint: 'Respuesta corta en una sola línea.',
  },
  {
    field_key: 'cedula',
    label: 'Cédula',
    type: 'cedula',
    hint: 'Acepta exactamente 10 dígitos numéricos.',
  },
];

let draftGroupId = 0;
let draftGroupFieldId = 0;
const newVisitantesGroup = (group = {}) => ({
  draftId: ++draftGroupId,
  minCount: group.min_count ? 1 : 0,
  aplica_a:
    group.aplica_a === 'TODOS' || group.aplica_a === undefined
      ? 'TODOS'
      : Array.isArray(group.aplica_a)
        ? [...group.aplica_a]
        : [],
  fields: VISITANTES_FIELD_TEMPLATES.map((template) => {
    const existing = Array.isArray(group.fields)
      ? group.fields.find((field) => field.field_key === template.field_key)
      : null;
    return {
      draftId: ++draftGroupFieldId,
      field_key: template.field_key,
      label: template.label,
      type: template.type,
      hint: template.hint,
      required: existing ? Boolean(existing.required) : true,
    };
  }),
});

const resolveGroupForDraft = (group, tiposById) => {
  if (group.aplica_a === 'TODOS' || !Array.isArray(group.tipos)) {
    return newVisitantesGroup(group);
  }
  return newVisitantesGroup({
    ...group,
    aplica_a: group.tipos.map((tipoId) => tiposById.get(tipoId)).filter(Boolean),
  });
};

const buildApiGroups = (groups) => {
  if (!groups.length) return [];
  const group = groups[0];
  return [
    {
      group_key: VISITANTES_GROUP_KEY,
      label: VISITANTES_GROUP_LABEL,
      min_count: group.minCount ? 1 : 0,
      aplica_a: group.aplica_a,
      fields: group.fields.map((field) => ({
        field_key: field.field_key,
        label: field.label,
        type: field.type,
        required: Boolean(field.required),
      })),
    },
  ];
};

const FormStatus = ({ status }) => (
  <span className={`badge badge-${status === 'ACTIVE' ? 'active' : 'inactive'}`}>
    {status === 'ACTIVE' ? 'ACTIVO' : 'ARCHIVADO'}
  </span>
);

const aplicaALabel = (item, tiposById) => {
  if (item.aplica_a === 'TODOS') return 'Todos';
  const nombres = (item.tipos || []).map((tipoId) => tiposById.get(tipoId)).filter(Boolean);
  return nombres.length ? nombres.join(', ') : 'Sin tipos asignados';
};

const requiredLabel = (required) => (required ? 'Requerido' : 'Opcional');

const FormActions = ({ form, canGestionar, canDelete, onEdit, onArchive, onPreview, onDelete }) => {
  if (!canGestionar) return null;
  if (form.estado === 'ACTIVE') {
    return (
      <div className="action-buttons app-table-actions">
        <button
          className="action-btn action-btn-edit"
          onClick={() => onEdit(form)}
          title="Editar formulario"
          aria-label={`Editar formulario de ${form.ubicacion_nombre}`}
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="action-btn action-btn-cancel"
          onClick={() => onArchive(form)}
          title="Cambiar estado"
          aria-label={`Archivar formulario de ${form.ubicacion_nombre}`}
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 5h18v3.5H3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 8.5V18a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V8.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 13h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    );
  }
  if (form.estado === 'ARCHIVED') {
    return (
      <div className="action-buttons app-table-actions">
        <button
          className="action-btn action-btn-edit"
          onClick={() => onPreview(form)}
          title="Vista previa"
          aria-label={`Vista previa del formulario de ${form.ubicacion_nombre}`}
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          </svg>
        </button>
        {canDelete ? (
          <button
            className="action-btn action-btn-cancel"
            onClick={() => onDelete(form)}
            title="Eliminar formulario"
            aria-label={`Eliminar formulario de ${form.ubicacion_nombre}`}
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6m3 0V4h8v2M10 10v6M14 10v6" />
            </svg>
          </button>
        ) : null}
      </div>
    );
  }
  return null;
};

const FormularioVisitasAdmin = ({
  ubicaciones,
  showToast,
  isBuilderOpen,
  onOpenBuilder,
  onCloseBuilder,
  onFiltersChange,
  canGestionar = false,
  canDelete = false,
  onTotalChange,
  onFormsChanged,
}) => {
  const urbanLocations = useMemo(
    () => ubicaciones.filter((location) => location.tipo_punto === 'URBANIZACION'),
    [ubicaciones]
  );
  const [forms, setForms] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [filtersDraft, setFiltersDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ field: 'published_at', direction: 'desc' });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [creators, setCreators] = useState([]);
  const [ubicacionId, setUbicacionId] = useState('');
  const [title, setTitle] = useState('Formulario de visitas');
  const [showDateTime, setShowDateTime] = useState(true);
  const [tiposVisita, setTiposVisita] = useState([]);
  const [tipoDraft, setTipoDraft] = useState('');
  const [fields, setFields] = useState([newField()]);
  const [groups, setGroups] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [previewDetail, setPreviewDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isReactivating, setIsReactivating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const requestSequenceRef = useRef(0);

  const loadForms = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setListLoading(true);
    setListError('');
    const result = await bitacorasService.getFormulariosVisitas({
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort.field,
      sortOrder: sort.direction,
      ...filters,
    });
    if (requestId !== requestSequenceRef.current) return;
    if (result.success) {
      setForms(Array.isArray(result.data) ? result.data : []);
      setTotalItems(result.meta?.totalItems || 0);
      setTotalPages(Math.max(1, result.meta?.totalPages || 1));
      setCreators(Array.isArray(result.filters?.creators) ? result.filters.creators : []);
    } else setListError(getVisibleErrorMessage(result, 'No se pudieron cargar los formularios.'));
    setListLoading(false);
  }, [filters, page, sort]);

  const handleSort = (field) => {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  useEffect(() => {
    void loadForms();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadForms]);

  useEffect(() => {
    onTotalChange?.(totalItems);
  }, [totalItems, onTotalChange]);

  useEffect(() => {
    if (!isBuilderOpen) {
      setUbicacionId('');
      setTitle('Formulario de visitas');
      setShowDateTime(true);
      setTiposVisita([]);
      setTipoDraft('');
      setFields([newField()]);
      setGroups([]);
      setActiveForm(null);
      setTemplateError('');
      setLoadingTemplate(false);
      return undefined;
    }
    if (!ubicacionId) {
      setActiveForm(null);
      return undefined;
    }
    let stale = false;
    setLoadingTemplate(true);
    setTemplateError('');
    bitacorasService.getFormularioVisitasActivo(ubicacionId).then((result) => {
      if (stale) return;
      setLoadingTemplate(false);
      if (result.success) {
        const tipos = Array.isArray(result.data.tipos) ? result.data.tipos : [];
        const tiposById = new Map(tipos.map((tipo) => [tipo.id, tipo.nombre]));
        setActiveForm(result.data);
        setTitle(result.data.titulo || 'Formulario de visitas');
        setShowDateTime(result.data.mostrar_fecha_hora !== false);
        setTiposVisita(tipos.map((tipo) => newTipoVisita(tipo)));
        setTipoDraft('');
        setFields(
          result.data.fields?.length
            ? result.data.fields.map((field) => resolveFieldForDraft(field, tiposById))
            : []
        );
        setGroups(
          result.data.groups?.length
            ? result.data.groups.map((group) => resolveGroupForDraft(group, tiposById))
            : []
        );
      } else if (result.status === 404) {
        setActiveForm(null);
        setTitle('Formulario de visitas');
        setShowDateTime(true);
        setTiposVisita([]);
        setTipoDraft('');
        setFields([newField()]);
        setGroups([]);
      } else {
        setTemplateError(getVisibleErrorMessage(result, 'No se pudo cargar la versión activa.'));
      }
    });
    return () => {
      stale = true;
    };
  }, [isBuilderOpen, ubicacionId]);

  const closeBuilder = () => {
    if (!saving) onCloseBuilder();
  };

  const updateField = (draftId, patch) => {
    setFields((current) =>
      current.map((field) => (field.draftId === draftId ? { ...field, ...patch } : field))
    );
  };

  const addOption = (field) => {
    const option = field.optionDraft.trim();
    if (!option || field.options.includes(option)) return;
    updateField(field.draftId, { options: [...field.options, option], optionDraft: '' });
  };

  const addTipoVisita = () => {
    const tipo = tipoDraft.trim();
    if (
      !tipo ||
      tiposVisita.some((existing) => existing.nombre.toLowerCase() === tipo.toLowerCase())
    )
      return;
    setTiposVisita((current) => [...current, newTipoVisita({ nombre: tipo })]);
    setTipoDraft('');
  };

  const removeTipoVisita = (tipo) => {
    setTiposVisita((current) => current.filter((item) => item.nombre !== tipo));
    setFields((current) =>
      current.map((field) =>
        Array.isArray(field.aplica_a)
          ? { ...field, aplica_a: field.aplica_a.filter((item) => item !== tipo) }
          : field
      )
    );
    setGroups((current) =>
      current.map((group) =>
        Array.isArray(group.aplica_a)
          ? { ...group, aplica_a: group.aplica_a.filter((item) => item !== tipo) }
          : group
      )
    );
  };

  const toggleTipoRequiereSalida = (tipo, requiereSalida) => {
    setTiposVisita((current) =>
      current.map((item) => (item.nombre === tipo ? { ...item, requiereSalida } : item))
    );
  };

  const toggleFieldTipo = (field, tipo) => {
    const selected = Array.isArray(field.aplica_a) ? field.aplica_a : [];
    const next = selected.includes(tipo)
      ? selected.filter((item) => item !== tipo)
      : [...selected, tipo];
    updateField(field.draftId, { aplica_a: next });
  };

  const updateGroup = (draftId, patch) => {
    setGroups((current) =>
      current.map((group) => (group.draftId === draftId ? { ...group, ...patch } : group))
    );
  };

  const toggleGroupTipo = (group, tipo) => {
    const selected = Array.isArray(group.aplica_a) ? group.aplica_a : [];
    const next = selected.includes(tipo)
      ? selected.filter((item) => item !== tipo)
      : [...selected, tipo];
    updateGroup(group.draftId, { aplica_a: next });
  };

  const toggleVisitantesGroup = (enabled) => {
    setGroups(enabled ? [newVisitantesGroup()] : []);
  };

  const updateGroupField = (groupDraftId, fieldDraftId, patch) => {
    setGroups((current) =>
      current.map((group) =>
        group.draftId === groupDraftId
          ? {
              ...group,
              fields: group.fields.map((field) =>
                field.draftId === fieldDraftId ? { ...field, ...patch } : field
              ),
            }
          : group
      )
    );
  };

  const handlePublish = async () => {
    if (!ubicacionId || saving) return;
    if (tiposVisita.length === 0) {
      showToast('Agrega al menos un tipo de visita.', 'error');
      return;
    }
    const apiFields = buildApiFields(fields);
    const invalidList = apiFields.find(
      (field) => field.type === 'select' && field.options.length === 0
    );
    if (invalidList) {
      showToast(`Agrega al menos una opción para "${invalidList.label}".`, 'error');
      return;
    }
    const invalidApplies = apiFields.find(
      (field) => Array.isArray(field.aplica_a) && field.aplica_a.length === 0
    );
    if (invalidApplies) {
      showToast(
        `Selecciona al menos un tipo de visita para "${invalidApplies.label}", o elige Todos.`,
        'error'
      );
      return;
    }
    const apiGroups = buildApiGroups(groups);
    const invalidGroupApplies = apiGroups.find(
      (group) => Array.isArray(group.aplica_a) && group.aplica_a.length === 0
    );
    if (invalidGroupApplies) {
      showToast(
        `Selecciona al menos un tipo de visita para el grupo "${invalidGroupApplies.label}", o elige Todos.`,
        'error'
      );
      return;
    }
    // Deduplicación: si el grupo Visitantes está habilitado, Nombre/Cédula ya
    // quedan cubiertos por sus dos campos fijos y no pueden repetirse como
    // preguntas normales sueltas (el backend refuerza la misma regla).
    if (apiGroups.length > 0) {
      const visitantesKeys = new Set(apiGroups[0].fields.map((field) => field.field_key));
      const duplicateField = apiFields.find((field) => visitantesKeys.has(field.field_key));
      if (duplicateField) {
        showToast(
          `"${duplicateField.label}" duplica un campo del grupo Visitantes. Quítalo de las preguntas normales.`,
          'error'
        );
        return;
      }
    }
    setSaving(true);
    const result = await bitacorasService.publishFormularioVisitas(ubicacionId, {
      titulo: title.trim() || 'Formulario de visitas',
      mostrar_fecha_hora: showDateTime,
      tipos_visita: tiposVisita.map((tipo) => ({
        nombre: tipo.nombre,
        requiere_salida: tipo.requiereSalida,
      })),
      fields: apiFields,
      grupos: apiGroups,
    });
    setSaving(false);
    if (result.success) {
      showToast(result.message || 'Formulario publicado.', 'success');
      onCloseBuilder();
      await loadForms();
      onFormsChanged?.();
      return;
    }
    showToast(getVisibleErrorMessage(result, 'No se pudo publicar el formulario.'), 'error');
  };

  const handleEditRequest = (form) => {
    setUbicacionId(String(form.ubicacion_id));
    onOpenBuilder?.();
  };

  const handleArchiveConfirmed = async () => {
    if (!archiveTarget || isArchiving) return;
    setIsArchiving(true);
    const result = await bitacorasService.archiveFormularioVisitas(archiveTarget.id);
    setIsArchiving(false);
    if (result.success) {
      showToast(result.message || 'Formulario archivado.', 'success');
      setArchiveTarget(null);
      await loadForms();
      onFormsChanged?.();
      return;
    }
    showToast(
      getVisibleErrorMessage(result, 'No se pudo cambiar el estado del formulario.'),
      'error'
    );
  };

  const handlePreviewRequest = async (form) => {
    setPreviewTarget(form);
    setPreviewDetail(null);
    setPreviewError('');
    setPreviewLoading(true);
    const result = await bitacorasService.getFormularioVisitasDetalle(form.id);
    setPreviewLoading(false);
    if (result.success) {
      setPreviewDetail(result.data);
      return;
    }
    setPreviewError(getVisibleErrorMessage(result, 'No se pudo cargar la vista previa.'));
  };

  const closePreview = () => {
    if (isReactivating) return;
    setPreviewTarget(null);
    setPreviewDetail(null);
    setPreviewError('');
  };

  const handleReactivateConfirmed = async () => {
    if (!previewTarget || !previewDetail || isReactivating) return;
    setIsReactivating(true);
    const result = await bitacorasService.activateFormularioVisitas(previewTarget.id);
    setIsReactivating(false);
    if (result.success) {
      showToast(result.message || 'Formulario activado.', 'success');
      setPreviewTarget(null);
      setPreviewDetail(null);
      setPreviewError('');
      await loadForms();
      onFormsChanged?.();
      return;
    }
    showToast(getVisibleErrorMessage(result, 'No se pudo activar el formulario.'), 'error');
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    const result = await bitacorasService.deleteFormularioVisitas(deleteTarget.id);
    setIsDeleting(false);
    if (result.success) {
      showToast(result.message || 'Formulario eliminado.', 'success');
      setDeleteTarget(null);
      await loadForms();
      onFormsChanged?.();
      return;
    }
    showToast(getVisibleErrorMessage(result, 'No se pudo eliminar el formulario.'), 'error');
  };

  return (
    <>
      <TabularWorkspace
        className="bitacoras-history bitacoras-forms-workspace"
        summary={
          !listLoading && !listError ? (
            <div className="table-result-count">
              Mostrando {forms.length} de {totalItems} formulario(s)
            </div>
          ) : null
        }
        controls={
          <div className="ff-filter-row bitacoras-forms-filter-row">
            <div className="ff-filter-card">
              <div className="ff-controls">
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
                    aria-label="Filtrar por nombre"
                    placeholder="Nombre del formulario"
                    value={filtersDraft.nombre}
                    onChange={(event) =>
                      setFiltersDraft((current) => ({ ...current, nombre: event.target.value }))
                    }
                  />
                </div>
                <div className="ff-state">
                  <label className="ff-state-label" htmlFor="formularios-filter-ubicacion">
                    Urbanización
                  </label>
                  <select
                    id="formularios-filter-ubicacion"
                    value={filtersDraft.ubicacion_id}
                    onChange={(event) =>
                      setFiltersDraft((current) => ({
                        ...current,
                        ubicacion_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Todas</option>
                    {urbanLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ff-state">
                  <label className="ff-state-label" htmlFor="formularios-filter-creator">
                    Creador
                  </label>
                  <select
                    id="formularios-filter-creator"
                    value={filtersDraft.creator}
                    onChange={(event) =>
                      setFiltersDraft((current) => ({ ...current, creator: event.target.value }))
                    }
                  >
                    <option value="">Todos</option>
                    {creators.map((creator) => (
                      <option key={creator.id} value={creator.usuario}>
                        {creator.usuario}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ff-state">
                  <label className="ff-state-label" htmlFor="formularios-filter-estado">
                    Estado
                  </label>
                  <select
                    id="formularios-filter-estado"
                    value={filtersDraft.estado}
                    onChange={(event) =>
                      setFiltersDraft((current) => ({ ...current, estado: event.target.value }))
                    }
                  >
                    <option value="">Todos</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="ARCHIVED">Archivado</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="ff-filter-actions-card">
              <div className="ff-actions">
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setFilters(filtersDraft);
                    onFiltersChange?.(filtersDraft);
                  }}
                >
                  Aplicar
                </button>
                <button
                  className="ff-clear-btn"
                  type="button"
                  onClick={() => {
                    setFiltersDraft(EMPTY_FILTERS);
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                    onFiltersChange?.({});
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        }
        pagination={
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        }
      >
        {listLoading ? (
          <div className="loading bitacoras-history-state">Cargando formularios...</div>
        ) : listError ? (
          <div className="bitacoras-history-state" role="alert">
            <p>{listError}</p>
            <button className="btn btn-secondary" type="button" onClick={loadForms}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div className="table-responsive app-table-shell app-table-scroll bitacoras-forms-table">
              <table className="app-table bitacoras-forms-app-table">
                <thead>
                  <tr>
                    <SortHeader field="nombre" label="Nombre" sort={sort} onSort={handleSort} />
                    <SortHeader
                      field="ubicacion"
                      label="Urbanización"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <SortHeader
                      className="bitacoras-cell-estado"
                      field="version"
                      label="Versión"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <SortHeader
                      className="bitacoras-cell-estado"
                      field="estado"
                      label="Estado"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <SortHeader field="creador" label="Creador" sort={sort} onSort={handleSort} />
                    <SortHeader
                      field="published_at"
                      label="Fecha de publicación"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <th className="app-col-actions app-col-actions--double" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {forms.length > 0 ? (
                    forms.map((form, index) => (
                      <tr className={index % 2 === 0 ? 'row-even' : 'row-odd'} key={form.id}>
                        <td>{form.titulo}</td>
                        <td>{form.ubicacion_nombre}</td>
                        <td className="bitacoras-cell-estado">{form.version}</td>
                        <td className="bitacoras-cell-estado">
                          <FormStatus status={form.estado} />
                        </td>
                        <td>{form.creador || '—'}</td>
                        <td>{form.published_at ? formatLocalTimestamp(form.published_at) : '—'}</td>
                        <td className="app-col-actions app-col-actions--double">
                          <FormActions
                            form={form}
                            canGestionar={canGestionar}
                            canDelete={canDelete}
                            onEdit={handleEditRequest}
                            onArchive={setArchiveTarget}
                            onPreview={handlePreviewRequest}
                            onDelete={setDeleteTarget}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="empty-row">
                      <td colSpan="7">No hay formularios publicados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="records-mobile bitacoras-form-mobile-cards">
              {forms.length === 0 ? (
                <p className="bitacoras-field-hint">No hay formularios publicados.</p>
              ) : (
                forms.map((form) => (
                  <article className="record-card bitacoras-record-card" key={form.id}>
                    <div className="record-card-header">
                      <h3>{form.titulo}</h3>
                      <FormStatus status={form.estado} />
                    </div>
                    <dl className="record-card-details">
                      <div>
                        <dt>Urbanización</dt>
                        <dd>{form.ubicacion_nombre}</dd>
                      </div>
                      <div>
                        <dt>Versión</dt>
                        <dd>{form.version}</dd>
                      </div>
                      <div>
                        <dt>Creador</dt>
                        <dd>{form.creador || '—'}</dd>
                      </div>
                      <div>
                        <dt>Publicado</dt>
                        <dd>{form.published_at ? formatLocalTimestamp(form.published_at) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Acciones</dt>
                        <dd>
                          <FormActions
                            form={form}
                            canGestionar={canGestionar}
                            canDelete={canDelete}
                            onEdit={handleEditRequest}
                            onArchive={setArchiveTarget}
                            onPreview={handlePreviewRequest}
                            onDelete={setDeleteTarget}
                          />
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </TabularWorkspace>

      <AppModal
        isOpen={isBuilderOpen}
        onClose={closeBuilder}
        title="Crear formulario de visitas"
        size="xl"
        closeOnBackdrop
        closeButtonDisabled={saving}
        className="bitacoras-form-builder-modal"
      >
        <AppModal.Header />
        <AppModal.Body aria-busy={loadingTemplate || saving}>
          <div className="bitacoras-admin-form">
            <div className="bitacoras-form-basics">
              <div className="form-group">
                <label htmlFor="visit-form-location">Urbanización</label>
                <select
                  id="visit-form-location"
                  value={ubicacionId}
                  onChange={(event) => setUbicacionId(event.target.value)}
                  disabled={saving}
                >
                  <option value="">Selecciona una Urbanización</option>
                  {urbanLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="visit-form-title">Nombre</label>
                <input
                  id="visit-form-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <label className="bitacoras-checkbox-field">
              <input
                type="checkbox"
                checked={showDateTime}
                onChange={(event) => setShowDateTime(event.target.checked)}
                disabled={saving}
              />
              Mostrar fecha y hora en el formulario
            </label>
            <fieldset className="bitacoras-visit-types">
              <legend>Tipos de visita</legend>
              <div className="bitacoras-option-entry">
                <input
                  aria-label="Nuevo tipo de visita"
                  placeholder="Ej: Proveedor"
                  value={tipoDraft}
                  onChange={(event) => setTipoDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTipoVisita();
                    }
                  }}
                  disabled={saving || loadingTemplate}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={addTipoVisita}
                  disabled={saving || loadingTemplate}
                >
                  Agregar tipo
                </button>
              </div>
              {tiposVisita.length ? (
                <ul className="bitacoras-option-list bitacoras-tipo-visita-list">
                  {tiposVisita.map((tipo) => (
                    <li key={tipo.nombre} className="bitacoras-tipo-visita-row">
                      <span>{tipo.nombre}</span>
                      <label
                        className="bitacoras-checkbox-field bitacoras-tipo-visita-salida"
                        title="Requiere registrar salida"
                      >
                        <input
                          type="checkbox"
                          checked={tipo.requiereSalida}
                          onChange={(event) =>
                            toggleTipoRequiereSalida(tipo.nombre, event.target.checked)
                          }
                          disabled={saving}
                        />
                        Requiere registrar salida
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Quitar tipo de visita ${tipo.nombre}`}
                        onClick={() => removeTipoVisita(tipo.nombre)}
                        disabled={saving || tiposVisita.length <= 1}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="bitacoras-field-hint">
                  Agrega al menos un tipo de visita (ej. Peatón, Vehículo, Delivery).
                </p>
              )}
            </fieldset>
            {loadingTemplate ? <p className="bitacoras-field-hint">Cargando versión...</p> : null}
            {templateError ? <p className="bitacoras-filter-error">{templateError}</p> : null}
            {activeForm ? (
              <p className="bitacoras-field-hint">
                La nueva publicación reemplazará la versión activa {activeForm.version}.
              </p>
            ) : null}
            <h4 className="bitacoras-groups-title">Visitantes</h4>
            <p className="bitacoras-field-hint">
              Estructura predefinida para capturar visitantes repetibles (Nombre y Cédula fijos). El
              guardia podrá agregar Visitante 1, Visitante 2, Visitante 3...
            </p>
            <label className="bitacoras-checkbox-field bitacoras-group-toggle">
              <input
                type="checkbox"
                checked={groups.length > 0}
                onChange={(event) => toggleVisitantesGroup(event.target.checked)}
                disabled={loadingTemplate}
              />
              Habilitar grupo Visitantes
            </label>
            {!loadingTemplate && groups.length > 0
              ? groups.map((group) => (
                  <fieldset className="bitacoras-group-row" key={group.draftId}>
                    <legend>Visitantes</legend>
                    <label className="bitacoras-checkbox-field bitacoras-group-min-input">
                      <input
                        type="checkbox"
                        checked={group.minCount === 1}
                        onChange={(event) =>
                          updateGroup(group.draftId, { minCount: event.target.checked ? 1 : 0 })
                        }
                      />
                      Mínimo 1 registro
                    </label>
                    <div className="form-group bitacoras-applies-input bitacoras-group-applies">
                      <label htmlFor={`visit-group-applies-${group.draftId}`}>Aplica a</label>
                      <select
                        id={`visit-group-applies-${group.draftId}`}
                        aria-label="Aplica a"
                        value={group.aplica_a === 'TODOS' ? 'TODOS' : 'SELECCIONADOS'}
                        onChange={(event) =>
                          updateGroup(group.draftId, {
                            aplica_a: event.target.value === 'TODOS' ? 'TODOS' : [],
                          })
                        }
                      >
                        <option value="TODOS">Todos</option>
                        <option value="SELECCIONADOS">Tipos específicos</option>
                      </select>
                      {group.aplica_a !== 'TODOS' ? (
                        tiposVisita.length ? (
                          <div
                            className="bitacoras-applies-types"
                            aria-label="Tipos de visita para el grupo Visitantes"
                          >
                            {tiposVisita.map((tipo) => (
                              <label key={tipo.nombre} className="bitacoras-checkbox-field">
                                <input
                                  type="checkbox"
                                  checked={group.aplica_a.includes(tipo.nombre)}
                                  onChange={() => toggleGroupTipo(group, tipo.nombre)}
                                />
                                {tipo.nombre}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="bitacoras-field-hint">
                            Agrega tipos de visita para poder seleccionarlos aquí.
                          </p>
                        )
                      ) : null}
                    </div>
                    <div className="bitacoras-group-fields">
                      {group.fields.map((groupField) => (
                        <div
                          className="bitacoras-group-field-row bitacoras-group-field-row--fixed"
                          key={groupField.draftId}
                        >
                          <div className="bitacoras-group-field-fixed">
                            <span className="bitacoras-group-field-fixed-label">
                              {groupField.label}
                            </span>
                            <span className="bitacoras-field-hint">{groupField.hint}</span>
                          </div>
                          <label
                            className="bitacoras-checkbox-field bitacoras-group-field-required"
                            title="Requerido"
                          >
                            <input
                              type="checkbox"
                              checked={groupField.required}
                              onChange={(event) =>
                                updateGroupField(group.draftId, groupField.draftId, {
                                  required: event.target.checked,
                                })
                              }
                            />
                            <span>Requerido</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))
              : null}

            <h4 className="bitacoras-groups-title">Preguntas adicionales</h4>
            <div className="bitacoras-form-fields">
              {loadingTemplate
                ? null
                : fields.map((field, index) => (
                    <fieldset className="bitacoras-form-field-row" key={field.draftId}>
                      <legend>Pregunta {index + 1}</legend>
                      <div className="form-group bitacoras-question-input">
                        <label htmlFor={`visit-question-${field.draftId}`}>Pregunta</label>
                        <input
                          id={`visit-question-${field.draftId}`}
                          aria-label="Pregunta del campo"
                          placeholder="Escribe la pregunta"
                          value={field.label}
                          onChange={(event) =>
                            updateField(field.draftId, { label: event.target.value })
                          }
                        />
                      </div>
                      <div className="form-group bitacoras-type-input">
                        <label htmlFor={`visit-type-${field.draftId}`}>Tipo</label>
                        <select
                          id={`visit-type-${field.draftId}`}
                          aria-label="Tipo de campo"
                          value={field.type}
                          onChange={(event) =>
                            updateField(field.draftId, { type: event.target.value })
                          }
                        >
                          {FIELD_TYPES.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group bitacoras-applies-input">
                        <label htmlFor={`visit-applies-${field.draftId}`}>Aplica a</label>
                        <select
                          id={`visit-applies-${field.draftId}`}
                          aria-label="Aplica a"
                          value={field.aplica_a === 'TODOS' ? 'TODOS' : 'SELECCIONADOS'}
                          onChange={(event) =>
                            updateField(field.draftId, {
                              aplica_a: event.target.value === 'TODOS' ? 'TODOS' : [],
                            })
                          }
                        >
                          <option value="TODOS">Todos</option>
                          <option value="SELECCIONADOS">Tipos específicos</option>
                        </select>
                        {field.aplica_a !== 'TODOS' ? (
                          tiposVisita.length ? (
                            <div
                              className="bitacoras-applies-types"
                              aria-label={`Tipos de visita para pregunta ${index + 1}`}
                            >
                              {tiposVisita.map((tipo) => (
                                <label key={tipo.nombre} className="bitacoras-checkbox-field">
                                  <input
                                    type="checkbox"
                                    checked={field.aplica_a.includes(tipo.nombre)}
                                    onChange={() => toggleFieldTipo(field, tipo.nombre)}
                                  />
                                  {tipo.nombre}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="bitacoras-field-hint">
                              Agrega tipos de visita para poder seleccionarlos aquí.
                            </p>
                          )
                        ) : null}
                      </div>
                      <label className="bitacoras-checkbox-field bitacoras-required-input">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            updateField(field.draftId, { required: event.target.checked })
                          }
                        />
                        Requerido
                      </label>
                      <div className="bitacoras-remove-question-slot">
                        <button
                          className="action-btn action-btn-destructive"
                          type="button"
                          title="Eliminar pregunta"
                          aria-label="Eliminar pregunta"
                          onClick={() =>
                            setFields((current) =>
                              current.filter((item) => item.draftId !== field.draftId)
                            )
                          }
                          disabled={saving || loadingTemplate}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                      {field.type === 'select' ? (
                        <div className="bitacoras-list-options">
                          <label htmlFor={`visit-option-${field.draftId}`}>Opciones de Lista</label>
                          <div className="bitacoras-option-entry">
                            <input
                              id={`visit-option-${field.draftId}`}
                              aria-label="Nueva opción"
                              value={field.optionDraft}
                              onChange={(event) =>
                                updateField(field.draftId, { optionDraft: event.target.value })
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  addOption(field);
                                }
                              }}
                              placeholder="Escribe una opción"
                            />
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => addOption(field)}
                            >
                              Agregar opción
                            </button>
                          </div>
                          {field.options.length ? (
                            <ul className="bitacoras-option-list">
                              {field.options.map((option) => (
                                <li key={option}>
                                  <span>{option}</span>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    aria-label={`Quitar opción ${option}`}
                                    onClick={() =>
                                      updateField(field.draftId, {
                                        options: field.options.filter((item) => item !== option),
                                      })
                                    }
                                  >
                                    Quitar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="bitacoras-field-hint">Agrega al menos una opción.</p>
                          )}
                        </div>
                      ) : null}
                    </fieldset>
                  ))}
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setFields((current) => [...current, newField()])}
              disabled={loadingTemplate}
            >
              Agregar pregunta
            </button>
          </div>
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handlePublish}
            disabled={!ubicacionId || saving || loadingTemplate || tiposVisita.length === 0}
          >
            {saving ? 'Publicando...' : 'Publicar versión'}
          </button>
          <button
            className="btn btn-modal-clear"
            type="button"
            onClick={closeBuilder}
            disabled={saving}
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </AppModal>

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        title="Cambiar estado del formulario"
        message={
          archiveTarget
            ? `El formulario activo de "${archiveTarget.ubicacion_nombre}" (versión ${archiveTarget.version}) pasará a ARCHIVADO y dejará de usarse para registrar visitas.`
            : ''
        }
        confirmText="Archivar"
        processingText="Archivando..."
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isArchiving}
        onConfirm={handleArchiveConfirmed}
        onCancel={() => setArchiveTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Eliminar formulario archivado"
        message={
          deleteTarget
            ? `Se ocultará el formulario "${deleteTarget.titulo}" (versión ${deleteTarget.version}). Las visitas y la auditoría histórica se conservarán.`
            : ''
        }
        confirmText="Eliminar"
        processingText="Eliminando..."
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isDeleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />

      <AppModal
        isOpen={Boolean(previewTarget)}
        onClose={closePreview}
        title="Vista previa del formulario"
        size="lg"
        closeOnBackdrop
        closeButtonDisabled={isReactivating}
        className="bitacoras-form-preview-modal"
      >
        <AppModal.Header />
        <AppModal.Body aria-busy={previewLoading || isReactivating}>
          {previewLoading ? (
            <div className="loading bitacoras-history-state">Cargando formulario...</div>
          ) : previewError ? (
            <div className="bitacoras-history-state" role="alert">
              <p>{previewError}</p>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => handlePreviewRequest(previewTarget)}
              >
                Reintentar
              </button>
            </div>
          ) : previewDetail ? (
            <div className="bitacoras-form-preview">
              <div className="bitacoras-form-preview__heading">
                <div>
                  <span>Formulario</span>
                  <strong>{previewDetail.titulo}</strong>
                </div>
                <div>
                  <span>Versión</span>
                  <strong>{previewDetail.version}</strong>
                </div>
              </div>
              <section>
                <h4>Tipos de visita</h4>
                <ul className="bitacoras-form-preview__types">
                  {previewDetail.tipos.map((tipo, tipoIndex) => (
                    <li key={tipo.id || tipo.nombre || tipoIndex}>
                      <strong>{tipo.nombre}</strong>
                      <span>{tipo.requiere_salida ? 'Requiere salida' : 'No requiere salida'}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {previewDetail.groups.map((group, groupIndex) => {
                const tiposById = new Map(
                  previewDetail.tipos.map((tipo) => [tipo.id, tipo.nombre])
                );
                return (
                  <section key={group.id || group.group_key || groupIndex}>
                    <h4>{group.label}</h4>
                    <p className="bitacoras-form-preview__meta">
                      {group.min_count > 0 ? 'Requerido' : 'Opcional'} · Aplica a:{' '}
                      {aplicaALabel(group, tiposById)}
                    </p>
                    <ul className="bitacoras-form-preview__questions">
                      {group.fields.map((field, fieldIndex) => (
                        <li key={field.id || field.field_key || `${group.group_key}-${fieldIndex}`}>
                          <strong>{field.label}</strong>
                          <span>{requiredLabel(field.required)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <section>
                <h4>Preguntas</h4>
                {previewDetail.fields.length ? (
                  <ul className="bitacoras-form-preview__questions">
                    {previewDetail.fields.map((field, fieldIndex) => {
                      const tiposById = new Map(
                        previewDetail.tipos.map((tipo) => [tipo.id, tipo.nombre])
                      );
                      return (
                        <li key={field.id || field.field_key || fieldIndex}>
                          <strong>{field.label}</strong>
                          <span>
                            {requiredLabel(field.required)} · Aplica a:{' '}
                            {aplicaALabel(field, tiposById)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="bitacoras-field-hint">No contiene preguntas adicionales.</p>
                )}
              </section>
              <p className="bitacoras-form-preview__notice">
                Activar publicará este contenido como una nueva versión y archivará el formulario
                activo actual.
              </p>
            </div>
          ) : null}
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleReactivateConfirmed}
            disabled={!previewDetail || previewLoading || Boolean(previewError) || isReactivating}
          >
            {isReactivating ? 'Activando...' : 'Activar'}
          </button>
          <button
            className="btn btn-modal-clear"
            type="button"
            onClick={closePreview}
            disabled={isReactivating}
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </AppModal>
    </>
  );
};

export default FormularioVisitasAdmin;
