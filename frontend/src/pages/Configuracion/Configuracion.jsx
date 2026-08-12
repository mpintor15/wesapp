import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppModal from '../../components/AppModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import PaginationControls from '../Cuentas/components/PaginationControls';
import clientesService from '../../services/clientesService';
import inventarioService from '../../services/inventarioService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import ClientesCatalog from './ClientesCatalog';
import { getConfiguracionPermissions } from './utils/configuracionPermissions';
import './Configuracion.css';

const EMPTY_FORM = { nombre: '', cliente_id: '' };
const MAX_NOMBRE_LENGTH = 100;
const COLLAPSED_UBICACIONES_LIMIT = 5;
const UBICACIONES_PAGE_SIZE = 25;
const HISTORICAL_UNASSIGNED_CLIENT_VALUE = '__historical_unassigned_cliente__';
const CATALOG_TABS = [
  { id: 'clientes', label: 'Directorio' },
  { id: 'ubicaciones', label: 'Ubicaciones' },
];

const normalizeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeUbicacion = (ubicacion) => ({
  ...ubicacion,
  articulos_activos: normalizeCount(ubicacion?.articulos_activos),
  articulos_totales: normalizeCount(ubicacion?.articulos_totales),
});

const sortUbicacionesForCatalog = (items) =>
  [...items].sort((a, b) => {
    const aHasCliente = Boolean(a.cliente_id);
    const bHasCliente = Boolean(b.cliente_id);
    if (aHasCliente !== bHasCliente) return aHasCliente ? 1 : -1;

    const clienteCompare = String(a.cliente_nombre || '').localeCompare(
      String(b.cliente_nombre || ''),
      'es',
      { sensitivity: 'base', numeric: true }
    );
    if (clienteCompare !== 0) return clienteCompare;

    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {
      sensitivity: 'base',
      numeric: true,
    });
  });

const getBackendErrorMessage = (result, fallback) =>
  result?.status === 409
    ? result.message || 'Ya existe una ubicación con ese nombre.'
    : result?.message || fallback;

const getUbicacionesAgrupadasParams = ({ filters, page, pageSize, activeClienteFilter }) => {
  const params = {
    page,
    pageSize,
    include_empty: true,
    include_historical: true,
  };
  const visibleSearch = filters.search.trim();
  const contextualSearch =
    filters.cliente && activeClienteFilter?.nombre ? activeClienteFilter.nombre : '';
  const search = visibleSearch || contextualSearch;
  if (search.trim()) params.search = search.trim();
  return params;
};

const normalizeUbicacionGroup = (group) => {
  const ubicaciones = Array.isArray(group?.ubicaciones)
    ? group.ubicaciones.map((ubicacion) => ({
        ...normalizeUbicacion(ubicacion),
        estado_uso:
          ubicacion?.estado_uso ||
          (normalizeCount(ubicacion?.articulos_totales) > 0 ? 'en_uso' : 'sin_articulos'),
        puede_eliminar: Boolean(ubicacion?.puede_eliminar),
      }))
    : [];
  const total = normalizeCount(group?.resumen?.total ?? ubicaciones.length);
  const enUso = normalizeCount(
    group?.resumen?.en_uso ??
      ubicaciones.filter((ubicacion) => ubicacion.estado_uso === 'en_uso').length
  );
  return {
    tipo: group?.tipo || 'cliente',
    cliente_id: group?.cliente_id ?? null,
    cliente_nombre: group?.cliente_nombre || 'Cliente sin nombre',
    cliente_estado: group?.cliente_estado || null,
    ubicaciones,
    resumen: {
      total,
      en_uso: enUso,
      disponibles: normalizeCount(group?.resumen?.disponibles ?? total - enUso),
    },
  };
};

const getGroupKey = (group) =>
  group.tipo === 'sin_cliente' ? 'sin-cliente' : `cliente-${group.cliente_id}`;

const getGroupDisplayName = (group) =>
  group.cliente_estado === 'inactivo' ? `${group.cliente_nombre} (inactivo)` : group.cliente_nombre;

const getGroupSummaryText = (group) => {
  const total = normalizeCount(group.resumen?.total);
  if (total === 0) return 'Sin ubicaciones';
  const enUso = normalizeCount(group.resumen?.en_uso);
  const disponibles = normalizeCount(group.resumen?.disponibles);
  return `${total} ${total === 1 ? 'ubicación' : 'ubicaciones'} · ${enUso} en uso · ${disponibles} disponibles`;
};

const getLocationStatusMeta = (ubicacion) => {
  const total = normalizeCount(ubicacion.articulos_totales);
  const activos = normalizeCount(ubicacion.articulos_activos);
  const isBusy = ubicacion.estado_uso === 'en_uso' || total > 0;
  return {
    label: isBusy ? 'En uso' : 'Sin artículos',
    detail: `${activos} activos / ${total} totales`,
    className: isBusy
      ? 'configuracion-status-text configuracion-status-text--busy'
      : 'configuracion-status-text',
  };
};

const getUbicacionFieldError = (result) => {
  if (result?.code === 'CLIENT_INACTIVE' || result?.code === 'LOCATION_CLIENT_REQUIRED') {
    return { cliente_id: result.message };
  }
  if (result?.status === 409) {
    return { nombre: result.message };
  }
  return {};
};

const getUbicacionEmptyMessage = ({ hasFilters, activeClienteFilter }) => {
  if (activeClienteFilter) return 'Este cliente no tiene ubicaciones registradas.';
  if (hasFilters) return 'No se encontraron ubicaciones con los filtros actuales.';
  return 'No existen ubicaciones registradas.';
};

const UbicacionFormModal = ({
  error,
  form,
  fieldErrors,
  isOpen,
  isSubmitting,
  mode,
  onChange,
  onClose,
  onSubmit,
  clientes,
  editingUbicacion,
  lockedCliente,
}) => {
  const clienteRef = useRef(null);
  const nombreRef = useRef(null);
  const trimmedName = form.nombre.trim();
  const isNameTooLong = trimmedName.length > MAX_NOMBRE_LENGTH;
  const isPreservingHistoricalUnassigned =
    mode === 'edit' &&
    editingUbicacion?.cliente_id == null &&
    form.cliente_id === HISTORICAL_UNASSIGNED_CLIENT_VALUE;
  const activeClientes = clientes.filter((cliente) => cliente.estado !== 'inactivo');
  const hasSelectedActiveCliente = activeClientes.some(
    (cliente) => String(cliente.id) === String(form.cliente_id)
  );
  const isPreservingHistoricalCliente =
    mode === 'edit' &&
    Boolean(form.cliente_id) &&
    !isPreservingHistoricalUnassigned &&
    String(form.cliente_id) === String(editingUbicacion?.cliente_id);
  const isHistoricalInactiveCliente =
    Boolean(form.cliente_id) && !hasSelectedActiveCliente && isPreservingHistoricalCliente;
  const isUnsupportedInactiveCliente =
    Boolean(form.cliente_id) &&
    !isPreservingHistoricalUnassigned &&
    !hasSelectedActiveCliente &&
    !isPreservingHistoricalCliente;
  const inactiveClienteName = editingUbicacion?.cliente_nombre || 'Cliente inactivo';
  const isInvalid =
    !trimmedName ||
    (!form.cliente_id && !isPreservingHistoricalUnassigned) ||
    isUnsupportedInactiveCliente ||
    isNameTooLong ||
    isSubmitting;
  const isClienteLocked = mode === 'create' && Boolean(lockedCliente?.id);

  useEffect(() => {
    if (!isOpen) return;
    if (fieldErrors?.nombre) {
      nombreRef.current?.focus();
      return;
    }
    if (fieldErrors?.cliente_id) {
      clienteRef.current?.focus();
    }
  }, [fieldErrors, isOpen]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      closeButtonDisabled={isSubmitting}
      initialFocusRef={clienteRef}
      title={mode === 'edit' ? 'Editar ubicación' : 'Crear ubicación'}
      size="sm"
      className="configuracion-ubicacion-modal"
      ariaDescribedby="ubicacion-modal-description"
    >
      <form onSubmit={onSubmit} aria-busy={isSubmitting}>
        <AppModal.Header />
        <AppModal.Body id="ubicacion-modal-description" aria-busy={isSubmitting}>
          <p className="configuracion-modal-description">
            {mode === 'edit'
              ? 'Actualiza los datos de la ubicación sin cambiar su historial asociado.'
              : 'Crea una ubicación asociada a un cliente activo.'}
          </p>
          {error && (
            <div className="error-message" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          {isPreservingHistoricalUnassigned && (
            <div className="configuracion-form-warning" role="status">
              Esta ubicación no tiene cliente porque pertenece al historial. Puedes conservarla sin
              reasignar.
            </div>
          )}
          {isHistoricalInactiveCliente && (
            <div className="configuracion-form-warning" role="status">
              El cliente actual está inactivo y se conserva por historial.
            </div>
          )}
          {isClienteLocked && (
            <div className="configuracion-form-context" role="status">
              Nueva ubicación para <strong>{lockedCliente.nombre}</strong>. El cliente queda
              bloqueado para esta creación.
            </div>
          )}
          <div className="form-group">
            <label htmlFor="ubicacion-cliente">Cliente</label>
            <select
              id="ubicacion-cliente"
              ref={clienteRef}
              value={form.cliente_id}
              onChange={(event) => onChange({ cliente_id: event.target.value })}
              disabled={isSubmitting || isClienteLocked}
              aria-invalid={Boolean(fieldErrors?.cliente_id)}
              aria-describedby="ubicacion-cliente-help ubicacion-cliente-error"
            >
              <option value="">Selecciona un cliente</option>
              {isPreservingHistoricalUnassigned && (
                <option value={HISTORICAL_UNASSIGNED_CLIENT_VALUE}>
                  Sin cliente — dato histórico
                </option>
              )}
              {isHistoricalInactiveCliente && (
                <option value={form.cliente_id} disabled>
                  {inactiveClienteName} (inactivo)
                </option>
              )}
              {activeClientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
            <div className="configuracion-field-meta">
              <span id="ubicacion-cliente-help">
                {isClienteLocked
                  ? 'Cliente preseleccionado desde el listado. Abre la creación global para elegir otro cliente.'
                  : isPreservingHistoricalUnassigned
                    ? 'Se conserva el cliente histórico actual.'
                    : 'Obligatorio para crear o reasignar ubicaciones.'}
              </span>
            </div>
            {fieldErrors?.cliente_id && (
              <div id="ubicacion-cliente-error" className="field-error">
                {fieldErrors.cliente_id}
              </div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="ubicacion-nombre">Nombre</label>
            <input
              id="ubicacion-nombre"
              ref={nombreRef}
              type="text"
              value={form.nombre}
              maxLength={MAX_NOMBRE_LENGTH + 1}
              onChange={(event) => onChange({ nombre: event.target.value })}
              placeholder="Ej: Bodega principal"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors?.nombre)}
              aria-describedby="ubicacion-nombre-help ubicacion-nombre-error"
              autoFocus
            />
            <div id="ubicacion-nombre-help" className="configuracion-field-meta">
              <span>
                {isNameTooLong ? `Máximo ${MAX_NOMBRE_LENGTH} caracteres.` : 'Nombre obligatorio.'}
              </span>
              <span>{trimmedName.length}/100</span>
            </div>
            {fieldErrors?.nombre && (
              <div id="ubicacion-nombre-error" className="field-error">
                {fieldErrors.nombre}
              </div>
            )}
          </div>
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button className="btn btn-primary" type="submit" disabled={isInvalid}>
            {isSubmitting
              ? mode === 'edit'
                ? 'Guardando...'
                : 'Creando...'
              : mode === 'edit'
                ? 'Guardar cambios'
                : 'Crear ubicación'}
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

const Configuracion = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const permissions = useMemo(() => getConfiguracionPermissions(user), [user]);
  const tabRefs = useRef({});

  const [activeCatalog, setActiveCatalog] = useState('clientes');
  const [ubicacionGroups, setUbicacionGroups] = useState([]);
  const [expandedUbicacionGroups, setExpandedUbicacionGroups] = useState(() => new Set());
  const [ubicacionesMeta, setUbicacionesMeta] = useState({
    page: 1,
    pageSize: 25,
    totalGroups: 0,
    filteredGroups: 0,
    totalLocations: 0,
    filteredLocations: 0,
    totalPages: 0,
  });
  const [allUbicaciones, setAllUbicaciones] = useState([]);
  const [hasLoadedUbicacionesCatalogo, setHasLoadedUbicacionesCatalogo] = useState(false);
  const [ubicacionesLoading, setUbicacionesLoading] = useState(false);
  const [ubicacionesLoadError, setUbicacionesLoadError] = useState('');
  const [hasLoadedUbicaciones, setHasLoadedUbicaciones] = useState(false);
  const [clientesActivosLoading, setClientesActivosLoading] = useState(false);
  const [clientesActivosLoadError, setClientesActivosLoadError] = useState('');
  const [hasLoadedClientesActivos, setHasLoadedClientesActivos] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [editingUbicacion, setEditingUbicacion] = useState(null);
  const [lockedCreateCliente, setLockedCreateCliente] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [contextualClienteFilter, setContextualClienteFilter] = useState(null);
  const [ubicacionFiltersDraft, setUbicacionFiltersDraft] = useState({
    search: '',
    cliente: '',
  });
  const [ubicacionFilters, setUbicacionFilters] = useState({
    search: '',
    cliente: '',
  });
  const [ubicacionesPage, setUbicacionesPage] = useState(1);
  const ubicacionesPageSize = UBICACIONES_PAGE_SIZE;
  const [clienteCreateRequest, setClienteCreateRequest] = useState(0);
  const [clienteRefreshToken, setClienteRefreshToken] = useState(0);
  const [directorioTotal, setDirectorioTotal] = useState(0);

  const canCreate = permissions.canCreateUbicacion;
  const canEdit = permissions.canEditUbicacion;
  const canDelete = permissions.canDeleteUbicacion;
  const isUbicacionesActive = activeCatalog === 'ubicaciones';
  const isClientesActive = activeCatalog === 'clientes';
  const hasAnyAllowedCatalog = permissions.canViewClientes || permissions.canViewUbicaciones;
  const visibleTabs = useMemo(
    () =>
      CATALOG_TABS.filter((tab) =>
        tab.id === 'clientes' ? permissions.canViewClientes : permissions.canViewUbicaciones
      ),
    [permissions.canViewClientes, permissions.canViewUbicaciones]
  );
  const hasUbicacionFilters = Boolean(ubicacionFilters.search.trim() || ubicacionFilters.cliente);
  const ubicacionGroupKeys = useMemo(
    () => new Set(ubicacionGroups.map((group) => getGroupKey(group))),
    [ubicacionGroups]
  );

  useEffect(() => {
    setExpandedUbicacionGroups((current) => {
      const next = new Set([...current].filter((groupKey) => ubicacionGroupKeys.has(groupKey)));
      return next.size === current.size ? current : next;
    });
  }, [ubicacionGroupKeys]);

  const activeClienteFilter = useMemo(() => {
    const activeOption = clientes.find(
      (cliente) => String(cliente.id) === String(ubicacionFilters.cliente)
    );
    if (activeOption) return activeOption;
    if (
      contextualClienteFilter &&
      String(contextualClienteFilter.id) === String(ubicacionFilters.cliente)
    ) {
      return contextualClienteFilter;
    }
    return null;
  }, [clientes, contextualClienteFilter, ubicacionFilters.cliente]);

  const ubicacionesTotal = ubicacionesMeta.totalLocations || allUbicaciones.length;
  const canManageAnyUbicacion = canCreate || canEdit || canDelete;

  const loadUbicacionesCatalogo = useCallback(async () => {
    if (!permissions.canViewUbicaciones) return false;
    const result = await inventarioService.getUbicaciones({});
    if (result.success) {
      const nextUbicaciones = sortUbicacionesForCatalog(
        (result.data || []).map(normalizeUbicacion)
      );
      setAllUbicaciones(nextUbicaciones);
      setHasLoadedUbicacionesCatalogo(true);
    }
    return result.success;
  }, [permissions.canViewUbicaciones]);

  const loadUbicaciones = useCallback(async () => {
    if (!permissions.canViewUbicaciones) return false;
    setUbicacionesLoading(true);
    setUbicacionesLoadError('');
    const params = getUbicacionesAgrupadasParams({
      filters: ubicacionFilters,
      page: ubicacionesPage,
      pageSize: ubicacionesPageSize,
      activeClienteFilter,
    });
    const result = await inventarioService.getUbicacionesAgrupadas(params);
    if (result.success) {
      setUbicacionGroups((result.data || []).map(normalizeUbicacionGroup));
      setUbicacionesMeta({
        page: normalizeCount(result.meta?.page) || ubicacionesPage,
        pageSize: normalizeCount(result.meta?.pageSize) || ubicacionesPageSize,
        totalGroups: normalizeCount(result.meta?.totalGroups),
        filteredGroups: normalizeCount(result.meta?.filteredGroups),
        totalLocations: normalizeCount(result.meta?.totalLocations),
        filteredLocations: normalizeCount(result.meta?.filteredLocations),
        totalPages: normalizeCount(result.meta?.totalPages),
      });
      setHasLoadedUbicaciones(true);
    } else {
      setUbicacionesLoadError(result.message || 'Error al cargar ubicaciones');
    }
    setUbicacionesLoading(false);
    return result.success;
  }, [
    activeClienteFilter,
    permissions.canViewUbicaciones,
    ubicacionFilters,
    ubicacionesPage,
    ubicacionesPageSize,
  ]);

  const loadClientesActivos = useCallback(async () => {
    if (!permissions.canViewUbicaciones) return false;
    setClientesActivosLoading(true);
    setClientesActivosLoadError('');
    const result = await clientesService.listOpcionesUbicaciones();
    if (result.success) {
      setClientes((result.data || []).filter((cliente) => cliente.estado !== 'inactivo'));
      setHasLoadedClientesActivos(true);
    } else {
      setClientesActivosLoadError(result.message || 'Error al cargar clientes activos');
    }
    setClientesActivosLoading(false);
    return result.success;
  }, [permissions.canViewUbicaciones]);

  useEffect(() => {
    if (authLoading) return;
    if (permissions.canViewClientes) {
      setActiveCatalog((current) =>
        current === 'ubicaciones' && !permissions.canViewUbicaciones ? 'clientes' : current
      );
      return;
    }
    if (permissions.canViewUbicaciones) {
      setActiveCatalog('ubicaciones');
    }
  }, [authLoading, permissions.canViewClientes, permissions.canViewUbicaciones]);

  useEffect(() => {
    if (authLoading || hasLoadedUbicaciones || !permissions.canViewUbicaciones) return;
    void loadUbicaciones();
  }, [authLoading, hasLoadedUbicaciones, loadUbicaciones, permissions.canViewUbicaciones]);

  useEffect(() => {
    if (!isUbicacionesActive || hasLoadedUbicacionesCatalogo || !permissions.canViewUbicaciones) {
      return;
    }
    void loadUbicacionesCatalogo();
  }, [
    hasLoadedUbicacionesCatalogo,
    isUbicacionesActive,
    loadUbicacionesCatalogo,
    permissions.canViewUbicaciones,
  ]);

  useEffect(() => {
    if (!isUbicacionesActive || hasLoadedClientesActivos || !permissions.canViewUbicaciones) {
      return;
    }
    void loadClientesActivos();
  }, [
    hasLoadedClientesActivos,
    isUbicacionesActive,
    loadClientesActivos,
    permissions.canViewUbicaciones,
  ]);

  const resetModal = () => {
    setModalMode(null);
    setEditingUbicacion(null);
    setLockedCreateCliente(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormFieldErrors({});
  };

  const closeModal = () => {
    if (isSubmitting) return;
    resetModal();
  };

  const openCreateModal = (cliente = null) => {
    const clienteId =
      typeof cliente === 'object' && cliente !== null ? cliente.id : cliente ? cliente : '';
    const clienteName = typeof cliente === 'object' && cliente !== null ? cliente.nombre : '';
    setModalMode('create');
    setEditingUbicacion(null);
    setLockedCreateCliente(
      clienteId && clienteName ? { id: String(clienteId), nombre: clienteName } : null
    );
    setForm({ ...EMPTY_FORM, cliente_id: clienteId ? String(clienteId) : '' });
    setFormError('');
    setFormFieldErrors({});
  };

  const openEditModal = (ubicacion) => {
    setModalMode('edit');
    setEditingUbicacion(ubicacion);
    setForm({
      nombre: ubicacion.nombre || '',
      cliente_id:
        ubicacion.cliente_id == null
          ? HISTORICAL_UNASSIGNED_CLIENT_VALUE
          : String(ubicacion.cliente_id),
    });
    setFormError('');
    setFormFieldErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nombre = form.nombre.trim();
    if (!nombre) {
      setFormError('El nombre de la ubicación es obligatorio.');
      setFormFieldErrors({ nombre: 'El nombre de la ubicación es obligatorio.' });
      return;
    }
    if (nombre.length > MAX_NOMBRE_LENGTH) {
      setFormError(`El nombre no puede exceder ${MAX_NOMBRE_LENGTH} caracteres.`);
      setFormFieldErrors({ nombre: `El nombre no puede exceder ${MAX_NOMBRE_LENGTH} caracteres.` });
      return;
    }
    const isPreservingHistoricalUnassigned =
      modalMode === 'edit' &&
      editingUbicacion?.cliente_id == null &&
      form.cliente_id === HISTORICAL_UNASSIGNED_CLIENT_VALUE;
    if (!form.cliente_id && !isPreservingHistoricalUnassigned) {
      setFormError('Selecciona un cliente para la ubicación.');
      setFormFieldErrors({ cliente_id: 'Selecciona un cliente para la ubicación.' });
      return;
    }
    if (
      !clientes.some(
        (cliente) => String(cliente.id) === String(form.cliente_id) && cliente.estado !== 'inactivo'
      ) &&
      !isPreservingHistoricalUnassigned &&
      !(modalMode === 'edit' && String(form.cliente_id) === String(editingUbicacion?.cliente_id))
    ) {
      setFormError('Selecciona un cliente activo para la ubicación.');
      setFormFieldErrors({ cliente_id: 'Selecciona un cliente activo para la ubicación.' });
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    setFormFieldErrors({});
    const payload = {
      nombre,
      cliente_id: isPreservingHistoricalUnassigned ? null : Number(form.cliente_id),
    };
    try {
      const result =
        modalMode === 'edit'
          ? await inventarioService.updateUbicacion(editingUbicacion.id, payload)
          : await inventarioService.createUbicacion(payload);

      if (!result.success) {
        const message = getBackendErrorMessage(
          result,
          modalMode === 'edit' ? 'Error al actualizar ubicación' : 'Error al crear ubicación'
        );
        setFormError(message);
        setFormFieldErrors(getUbicacionFieldError({ ...result, message }));
        return;
      }

      await Promise.all([loadUbicaciones(), loadUbicacionesCatalogo()]);
      showToast(
        modalMode === 'edit'
          ? 'Ubicación actualizada exitosamente'
          : 'Ubicación creada exitosamente',
        'success'
      );
      resetModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDelete = (ubicacion) => {
    if (ubicacion.puede_eliminar === false) return;
    setDeleteTarget(ubicacion);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await inventarioService.deleteUbicacion(deleteTarget.id);

      if (!result.success) {
        showToast(getVisibleErrorMessage(result, 'Error al eliminar ubicación'), 'error');
        return;
      }

      await Promise.all([loadUbicaciones(), loadUbicacionesCatalogo()]);
      showToast('Ubicación eliminada exitosamente', 'success');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManageClienteUbicaciones = (cliente) => {
    if (!permissions.canViewUbicaciones) return;
    setActiveCatalog('ubicaciones');
    setContextualClienteFilter(cliente?.estado === 'inactivo' ? cliente : null);
    const nextFilters = { search: cliente?.nombre || '', cliente: String(cliente.id) };
    setUbicacionFiltersDraft(nextFilters);
    setUbicacionFilters(nextFilters);
    setUbicacionesPage(1);
    setHasLoadedUbicaciones(false);
  };

  const handleCreateUbicacionForCliente = (cliente) => {
    if (!permissions.canViewUbicaciones || !permissions.canCreateUbicacion) return;
    setActiveCatalog('ubicaciones');
    const canUseCliente = cliente?.id && cliente.estado !== 'inactivo';
    setContextualClienteFilter(null);
    const nextFilters = {
      search: canUseCliente ? cliente.nombre || '' : '',
      cliente: canUseCliente ? String(cliente.id) : '',
    };
    setUbicacionFiltersDraft(nextFilters);
    setUbicacionFilters(nextFilters);
    setUbicacionesPage(1);
    setHasLoadedUbicaciones(false);
    openCreateModal(canUseCliente ? cliente : null);
  };

  const handleUbicacionesSearchChange = (value) => {
    const nextFilters = { search: value, cliente: '' };
    setContextualClienteFilter(null);
    setUbicacionFiltersDraft(nextFilters);
    setUbicacionFilters(nextFilters);
    setUbicacionesPage(1);
    setExpandedUbicacionGroups(new Set());
    setHasLoadedUbicaciones(false);
  };

  const handleClientesLoaded = useCallback((nextClientes) => {
    setDirectorioTotal(nextClientes.length);
  }, []);

  const refreshDirectorio = async () => {
    setClienteRefreshToken((value) => value + 1);
  };

  const refreshUbicaciones = async () => {
    await Promise.all([loadUbicaciones(), loadUbicacionesCatalogo(), loadClientesActivos()]);
  };

  const handleUbicacionesPageChange = (nextPage) => {
    setUbicacionesPage((currentPage) => {
      const resolvedPage = typeof nextPage === 'function' ? nextPage(currentPage) : nextPage;
      return Math.max(1, Math.min(ubicacionesMeta.totalPages || 1, resolvedPage));
    });
    setExpandedUbicacionGroups(new Set());
    setHasLoadedUbicaciones(false);
  };

  const toggleUbicacionGroup = (group) => {
    const groupKey = getGroupKey(group);
    setExpandedUbicacionGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const getVisibleUbicaciones = (group) =>
    expandedUbicacionGroups.has(getGroupKey(group))
      ? group.ubicaciones
      : group.ubicaciones.slice(0, COLLAPSED_UBICACIONES_LIMIT);

  const focusCatalogTab = (tabId) => {
    setActiveCatalog(tabId);
    window.requestAnimationFrame(() => tabRefs.current[tabId]?.focus());
  };

  const handleTabKeyDown = (event, tabId) => {
    const currentIndex = visibleTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % visibleTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleTabs.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveCatalog(tabId);
      return;
    } else {
      return;
    }

    event.preventDefault();
    focusCatalogTab(visibleTabs[nextIndex].id);
  };

  const handleClienteCatalogChanged = useCallback(async () => {
    setHasLoadedClientesActivos(false);
    if (permissions.canViewUbicaciones && isUbicacionesActive) {
      await loadClientesActivos();
    }
  }, [isUbicacionesActive, loadClientesActivos, permissions.canViewUbicaciones]);

  return (
    <div className="configuracion-container">
      <header className="brand-header page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate('/')} type="button">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="14"
              height="14"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver
          </button>
          <div>
            <h1>Clientes</h1>
          </div>
        </div>
        <div className="page-header-actions">
          {isClientesActive && permissions.canViewClientes && (
            <>
              {permissions.canCreateCliente && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setClienteCreateRequest((value) => value + 1)}
                  type="button"
                >
                  Crear cliente
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm btn-icon-only"
                onClick={refreshDirectorio}
                title="Actualizar datos"
                aria-label="Actualizar datos"
                type="button"
              >
                ↻
              </button>
            </>
          )}
          {isUbicacionesActive && canCreate && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openCreateModal()}
              type="button"
            >
              Crear ubicación
            </button>
          )}
          {isUbicacionesActive && (
            <button
              className="btn btn-ghost btn-sm btn-icon-only"
              onClick={refreshUbicaciones}
              title="Actualizar datos"
              aria-label="Actualizar datos"
              type="button"
              disabled={ubicacionesLoading || clientesActivosLoading}
            >
              ↻
            </button>
          )}
        </div>
      </header>

      <main>
        {authLoading ? (
          <div className="loading-spinner-wrap" role="status">
            <span className="spinner" />
            <span>Cargando permisos...</span>
          </div>
        ) : !hasAnyAllowedCatalog ? (
          <div className="empty-state">No tienes acceso al módulo de Clientes.</div>
        ) : (
          <>
            <div
              className="configuracion-tabs"
              role="tablist"
              aria-label="Catálogos de configuración"
            >
              {visibleTabs.map((tab) => {
                const selected = activeCatalog === tab.id;
                const count = tab.id === 'clientes' ? directorioTotal : ubicacionesTotal;
                return (
                  <button
                    key={tab.id}
                    ref={(element) => {
                      tabRefs.current[tab.id] = element;
                    }}
                    id={`configuracion-tab-${tab.id}`}
                    className={`tab ${selected ? 'active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`configuracion-panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveCatalog(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  >
                    {tab.label}
                    {count > 0 && <span className="tab-badge">{count}</span>}
                  </button>
                );
              })}
            </div>

            {permissions.canViewUbicaciones && (
              <section
                id="configuracion-panel-ubicaciones"
                className="tab-content configuracion-content"
                role="tabpanel"
                aria-labelledby="configuracion-tab-ubicaciones"
                aria-busy={ubicacionesLoading}
                hidden={!isUbicacionesActive}
              >
                {isUbicacionesActive && (
                  <>
                    <div className="ff-filter-row configuracion-ubicaciones-filter-row">
                      <div className="ff-filter-card configuracion-ubicaciones-filter-card">
                        <div className="ff-controls">
                          <div className="configuracion-ubicaciones-search-field">
                            <label className="ff-state-label" htmlFor="ubicaciones-search">
                              Buscar
                            </label>
                            <div className="ff-search configuracion-ubicaciones-search">
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
                                id="ubicaciones-search"
                                type="search"
                                value={ubicacionFiltersDraft.search}
                                onChange={(event) =>
                                  handleUbicacionesSearchChange(event.target.value)
                                }
                                placeholder="Cliente o ubicación"
                                aria-label="Buscar ubicación o cliente"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {ubicacionesLoadError && (
                      <div className="error-message configuracion-load-error" role="alert">
                        <span>{ubicacionesLoadError}</span>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={loadUbicaciones}
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
                    {clientesActivosLoadError && (
                      <div className="error-message configuracion-load-error">
                        <span>{clientesActivosLoadError}</span>
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={loadClientesActivos}
                        >
                          Reintentar clientes
                        </button>
                      </div>
                    )}

                    {ubicacionesLoading && ubicacionGroups.length === 0 ? (
                      <div className="loading-spinner-wrap" role="status" aria-live="polite">
                        <span className="spinner" />
                        <span>Cargando ubicaciones...</span>
                      </div>
                    ) : (
                      <>
                        {ubicacionesLoading && (
                          <div
                            className="configuracion-inline-loading"
                            role="status"
                            aria-live="polite"
                          >
                            <span className="spinner spinner--sm" />
                            <span>Actualizando ubicaciones...</span>
                          </div>
                        )}
                        <div className="table-result-count" role="status" aria-live="polite">
                          Mostrando {ubicacionesMeta.filteredGroups} cliente(s) /{' '}
                          {ubicacionesMeta.filteredLocations} ubicación(es)
                        </div>
                        <div className="table-responsive app-table-shell configuracion-ubicaciones-table-shell">
                          <table className="app-table configuracion-ubicaciones-table">
                            <caption className="sr-only">
                              Listado de ubicaciones con cliente, información operativa y acciones
                              disponibles
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">Cliente</th>
                                <th scope="col">Ubicaciones</th>
                                <th scope="col">Estado</th>
                                {canManageAnyUbicacion && (
                                  <th
                                    scope="col"
                                    className="app-col-actions"
                                    aria-label="Acciones disponibles"
                                  />
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {ubicacionGroups.length === 0 ? (
                                <tr className="empty-row">
                                  <td colSpan={canManageAnyUbicacion ? 4 : 3}>
                                    <div className="configuracion-empty-state" role="status">
                                      <span>
                                        {getUbicacionEmptyMessage({
                                          hasFilters: hasUbicacionFilters,
                                          activeClienteFilter,
                                        })}
                                      </span>
                                      {hasUbicacionFilters && (
                                        <span className="configuracion-empty-hint">
                                          Borra el texto de búsqueda para restaurar el listado.
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                ubicacionGroups.map((group, index) => {
                                  const groupSummary = getGroupSummaryText(group);
                                  const groupDisplayName = getGroupDisplayName(group);
                                  const isHistoricalGroup = group.tipo === 'sin_cliente';
                                  const groupKey = getGroupKey(group);
                                  const visibleUbicaciones = getVisibleUbicaciones(group);
                                  const hiddenUbicacionesCount =
                                    group.ubicaciones.length - visibleUbicaciones.length;
                                  const isExpanded = expandedUbicacionGroups.has(groupKey);
                                  const hasToggle =
                                    group.ubicaciones.length > COLLAPSED_UBICACIONES_LIMIT;
                                  const renderedRows =
                                    visibleUbicaciones.length > 0 ? visibleUbicaciones : [null];
                                  const clientRowSpan = renderedRows.length + (hasToggle ? 1 : 0);
                                  const groupRowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
                                  return (
                                    <React.Fragment key={groupKey}>
                                      {renderedRows.map((ubicacion, locationIndex) => {
                                        const status = ubicacion
                                          ? getLocationStatusMeta(ubicacion)
                                          : null;
                                        return (
                                          <tr
                                            key={ubicacion?.id || `${groupKey}-empty`}
                                            className={`configuracion-location-table-row ${groupRowClass}`}
                                          >
                                            {locationIndex === 0 && (
                                              <td
                                                className="configuracion-client-cell"
                                                title={groupDisplayName}
                                                rowSpan={clientRowSpan}
                                              >
                                                <span className="configuracion-client-name">
                                                  {groupDisplayName}
                                                </span>
                                                <small className="configuracion-group-summary">
                                                  {groupSummary}
                                                </small>
                                              </td>
                                            )}
                                            <td className="configuracion-location-cell">
                                              {ubicacion ? (
                                                <span
                                                  className="configuracion-location-name"
                                                  title={ubicacion.nombre}
                                                >
                                                  {ubicacion.nombre}
                                                </span>
                                              ) : (
                                                <span className="configuracion-muted-value">
                                                  Sin ubicaciones
                                                </span>
                                              )}
                                            </td>
                                            <td className="configuracion-operational-cell">
                                              {status ? (
                                                <>
                                                  <span className={status.className}>
                                                    {status.label}
                                                  </span>
                                                  <small>{status.detail}</small>
                                                </>
                                              ) : (
                                                <span className="configuracion-status-text">
                                                  Sin ubicaciones
                                                </span>
                                              )}
                                            </td>
                                            {canManageAnyUbicacion && (
                                              <td className="app-col-actions app-col-actions--triple">
                                                <div
                                                  className="action-buttons app-table-actions"
                                                  aria-label={
                                                    ubicacion
                                                      ? `Acciones de ubicación ${ubicacion.nombre}`
                                                      : `Acciones de cliente ${groupDisplayName}`
                                                  }
                                                >
                                                  {locationIndex === 0 &&
                                                    canCreate &&
                                                    !isHistoricalGroup && (
                                                      <button
                                                        className="action-btn action-btn-add"
                                                        type="button"
                                                        onClick={() =>
                                                          openCreateModal({
                                                            id: group.cliente_id,
                                                            nombre: groupDisplayName,
                                                          })
                                                        }
                                                        title={`Crear ubicación para ${groupDisplayName}`}
                                                        aria-label={`Crear ubicación para ${groupDisplayName}`}
                                                      >
                                                        <svg
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          width="14"
                                                          height="14"
                                                          aria-hidden="true"
                                                        >
                                                          <path d="M12 5v14M5 12h14" />
                                                          <path d="M4 4h16v16H4z" />
                                                        </svg>
                                                      </button>
                                                    )}
                                                  {ubicacion && canEdit && (
                                                    <button
                                                      className="action-btn action-btn-edit"
                                                      type="button"
                                                      onClick={() =>
                                                        openEditModal({
                                                          ...ubicacion,
                                                          cliente_id: group.cliente_id,
                                                          cliente_nombre: group.cliente_nombre,
                                                          cliente_estado: group.cliente_estado,
                                                        })
                                                      }
                                                      title="Editar ubicación"
                                                      aria-label={`Editar ubicación ${ubicacion.nombre}`}
                                                    >
                                                      <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        width="14"
                                                        height="14"
                                                        aria-hidden="true"
                                                      >
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                      </svg>
                                                    </button>
                                                  )}
                                                  {ubicacion &&
                                                    canDelete &&
                                                    ubicacion.puede_eliminar && (
                                                      <button
                                                        className="action-btn action-btn-del"
                                                        type="button"
                                                        onClick={() =>
                                                          requestDelete({
                                                            ...ubicacion,
                                                            cliente_id: group.cliente_id,
                                                            cliente_nombre: group.cliente_nombre,
                                                            cliente_estado: group.cliente_estado,
                                                          })
                                                        }
                                                        title="Eliminar ubicación"
                                                        aria-label={`Eliminar ubicación ${ubicacion.nombre}`}
                                                      >
                                                        <svg
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          width="14"
                                                          height="14"
                                                          aria-hidden="true"
                                                        >
                                                          <path d="M3 6h18" />
                                                          <path d="M8 6V4h8v2" />
                                                          <path d="M19 6l-1 14H6L5 6" />
                                                        </svg>
                                                      </button>
                                                    )}
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })}
                                      {hasToggle && (
                                        <tr
                                          className={`configuracion-location-toggle-table-row ${groupRowClass}`}
                                        >
                                          <td colSpan={canManageAnyUbicacion ? 3 : 2}>
                                            <button
                                              className="configuracion-location-toggle"
                                              type="button"
                                              onClick={() => toggleUbicacionGroup(group)}
                                              aria-expanded={isExpanded}
                                            >
                                              <span>
                                                {isExpanded
                                                  ? 'Ver menos ubicaciones'
                                                  : `Ver ${hiddenUbicacionesCount} ubicaciones más`}
                                              </span>
                                              <svg
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                                focusable="false"
                                              >
                                                <path
                                                  d={isExpanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
                                                />
                                              </svg>
                                            </button>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                        {ubicacionesMeta.totalPages > 1 && (
                          <div className="configuracion-ubicaciones-pagination">
                            <PaginationControls
                              page={ubicacionesPage}
                              totalPages={ubicacionesMeta.totalPages}
                              onPageChange={handleUbicacionesPageChange}
                            />
                          </div>
                        )}
                        {ubicacionGroups.length > 0 && (
                          <ul className="records-mobile configuracion-ubicaciones-mobile-list">
                            {ubicacionGroups.map((group) => {
                              const groupKey = getGroupKey(group);
                              const cardTitleId = `ubicacion-group-title-${groupKey}`;
                              const groupDisplayName = getGroupDisplayName(group);
                              const isHistoricalGroup = group.tipo === 'sin_cliente';
                              const visibleUbicaciones = getVisibleUbicaciones(group);
                              const hiddenUbicacionesCount =
                                group.ubicaciones.length - visibleUbicaciones.length;
                              const isExpanded = expandedUbicacionGroups.has(groupKey);
                              return (
                                <li key={groupKey}>
                                  <article
                                    className="record-card configuracion-ubicacion-card"
                                    aria-labelledby={cardTitleId}
                                  >
                                    <div className="record-card-header">
                                      <div className="configuracion-ubicacion-card-title">
                                        <h3 id={cardTitleId}>{groupDisplayName}</h3>
                                        <span>{getGroupSummaryText(group)}</span>
                                      </div>
                                      {canCreate && !isHistoricalGroup && (
                                        <button
                                          className="action-btn action-btn-add"
                                          type="button"
                                          onClick={() =>
                                            openCreateModal({
                                              id: group.cliente_id,
                                              nombre: groupDisplayName,
                                            })
                                          }
                                          title={`Crear ubicación para ${groupDisplayName}`}
                                          aria-label={`Crear ubicación para ${groupDisplayName}`}
                                        >
                                          <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            width="14"
                                            height="14"
                                            aria-hidden="true"
                                          >
                                            <path d="M12 5v14M5 12h14" />
                                            <path d="M4 4h16v16H4z" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                    {group.ubicaciones.length === 0 ? (
                                      <div className="configuracion-empty-inline">
                                        Sin ubicaciones registradas.
                                      </div>
                                    ) : (
                                      <ul className="configuracion-location-card-list">
                                        {visibleUbicaciones.map((ubicacion) => {
                                          const status = getLocationStatusMeta(ubicacion);
                                          return (
                                            <li key={ubicacion.id}>
                                              <div className="configuracion-location-card-main">
                                                <span className="configuracion-location-name">
                                                  {ubicacion.nombre}
                                                </span>
                                                <div className="configuracion-location-card-status">
                                                  <span className={status.className}>
                                                    {status.label}
                                                  </span>
                                                  <small>{status.detail}</small>
                                                </div>
                                              </div>
                                              {(canEdit || canDelete) && (
                                                <div
                                                  className="record-card-actions configuracion-ubicacion-card-actions"
                                                  aria-label={`Acciones de ubicación ${ubicacion.nombre}`}
                                                >
                                                  {canEdit && (
                                                    <button
                                                      className="action-btn action-btn-edit"
                                                      type="button"
                                                      onClick={() =>
                                                        openEditModal({
                                                          ...ubicacion,
                                                          cliente_id: group.cliente_id,
                                                          cliente_nombre: group.cliente_nombre,
                                                          cliente_estado: group.cliente_estado,
                                                        })
                                                      }
                                                      title="Editar ubicación"
                                                      aria-label={`Editar ubicación ${ubicacion.nombre}`}
                                                    >
                                                      Editar
                                                    </button>
                                                  )}
                                                  {canDelete && ubicacion.puede_eliminar && (
                                                    <button
                                                      className="action-btn action-btn-del"
                                                      type="button"
                                                      onClick={() =>
                                                        requestDelete({
                                                          ...ubicacion,
                                                          cliente_id: group.cliente_id,
                                                          cliente_nombre: group.cliente_nombre,
                                                          cliente_estado: group.cliente_estado,
                                                        })
                                                      }
                                                      title="Eliminar ubicación"
                                                      aria-label={`Eliminar ubicación ${ubicacion.nombre}`}
                                                    >
                                                      Eliminar
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </li>
                                          );
                                        })}
                                        {group.ubicaciones.length > COLLAPSED_UBICACIONES_LIMIT && (
                                          <li className="configuracion-location-toggle-row">
                                            <button
                                              className="configuracion-location-toggle"
                                              type="button"
                                              onClick={() => toggleUbicacionGroup(group)}
                                              aria-expanded={isExpanded}
                                            >
                                              {isExpanded
                                                ? 'Ver menos ubicaciones'
                                                : `Ver ${hiddenUbicacionesCount} ubicaciones más`}
                                              <svg
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                                focusable="false"
                                              >
                                                <path
                                                  d={isExpanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
                                                />
                                              </svg>
                                            </button>
                                          </li>
                                        )}
                                      </ul>
                                    )}
                                  </article>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            )}
            {permissions.canViewClientes && (
              <div
                id="configuracion-panel-clientes"
                role="tabpanel"
                aria-labelledby="configuracion-tab-clientes"
                hidden={!isClientesActive}
              >
                <ClientesCatalog
                  ubicaciones={allUbicaciones}
                  createRequestToken={clienteCreateRequest}
                  refreshToken={clienteRefreshToken}
                  permissions={{
                    canCreateCliente: permissions.canCreateCliente,
                    canEditCliente: permissions.canEditCliente,
                    canDeleteCliente: permissions.canDeleteCliente,
                    canViewUbicaciones: permissions.canViewUbicaciones,
                    canCreateUbicacion: permissions.canCreateUbicacion,
                  }}
                  onClientesLoaded={handleClientesLoaded}
                  onCreateUbicacionForCliente={handleCreateUbicacionForCliente}
                  onClientesChanged={handleClienteCatalogChanged}
                  onManageUbicaciones={handleManageClienteUbicaciones}
                />
              </div>
            )}
          </>
        )}
      </main>

      <UbicacionFormModal
        error={formError}
        fieldErrors={formFieldErrors}
        form={form}
        isOpen={Boolean(modalMode)}
        isSubmitting={isSubmitting}
        mode={modalMode}
        onChange={(nextForm) => {
          if (lockedCreateCliente && Object.prototype.hasOwnProperty.call(nextForm, 'cliente_id')) {
            return;
          }
          setForm((prev) => ({ ...prev, ...nextForm }));
          setFormError('');
          setFormFieldErrors((prev) => {
            const nextErrors = { ...prev };
            Object.keys(nextForm).forEach((field) => {
              delete nextErrors[field];
            });
            return nextErrors;
          });
        }}
        onClose={closeModal}
        onSubmit={handleSubmit}
        clientes={clientes}
        editingUbicacion={editingUbicacion}
        lockedCliente={lockedCreateCliente}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Eliminar ubicación"
        message={
          deleteTarget
            ? `Eliminarás la ubicación "${deleteTarget.nombre}" del cliente "${deleteTarget.cliente_nombre || 'Sin cliente'}". No puede eliminarse si contiene artículos y esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar ubicación"
        processingText="Eliminando..."
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Configuracion;
