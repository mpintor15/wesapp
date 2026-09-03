import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../../components/AppModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingState from '../../components/LoadingState';
import PaginationControls from '../../components/PaginationControls';
import { useToast } from '../../context/ToastContext';
import clientesService from '../../services/clientesService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import { DEFAULT_PAGINATION } from '../../utils/pagination';

const EMPTY_CLIENTE_FORM = {
  nombre: '',
  tipo_identificacion: '',
  identificacion: '',
  telefono: '',
  correo: '',
  direccion: '',
  ciudad: '',
  estado: 'activo',
};
const MAX_NOMBRE_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;
const TIPO_IDENTIFICACION_OPTIONS = [
  { value: 'CEDULA', label: 'Cédula' },
  { value: 'RUC', label: 'RUC' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
];
const IDENTIFICACION_RULES = {
  CEDULA: { length: 10, message: 'La cédula debe tener exactamente 10 dígitos numéricos.' },
  RUC: { length: 13, message: 'El RUC debe tener exactamente 13 dígitos numéricos.' },
};

const getBackendErrorMessage = (result, fallback) =>
  result?.status === 409
    ? result.message || 'Ya existe un cliente con esa identificación.'
    : result?.message || fallback;

const trimClientePayload = (form) => ({
  nombre: form.nombre.trim(),
  tipo_identificacion: form.tipo_identificacion.trim(),
  identificacion: form.identificacion.trim(),
  telefono: form.telefono.trim(),
  correo: form.correo.trim(),
  direccion: form.direccion.trim(),
  ciudad: form.ciudad.trim(),
  estado: form.estado,
});

const validateClientePayload = (payload) => {
  const errors = {};

  if (!payload.nombre) {
    errors.nombre = 'El nombre del cliente es obligatorio.';
  } else if (payload.nombre.length > MAX_NOMBRE_LENGTH) {
    errors.nombre = `El nombre no puede exceder ${MAX_NOMBRE_LENGTH} caracteres.`;
  }

  const idRule = IDENTIFICACION_RULES[payload.tipo_identificacion];
  if (idRule && payload.identificacion) {
    if (!/^\d+$/.test(payload.identificacion) || payload.identificacion.length !== idRule.length) {
      errors.identificacion = idRule.message;
    }
  }

  if (payload.telefono && !PHONE_PATTERN.test(payload.telefono)) {
    errors.telefono = 'El teléfono debe tener exactamente 10 dígitos numéricos.';
  }

  if (payload.correo && !EMAIL_PATTERN.test(payload.correo)) {
    errors.correo = 'Ingresa un correo válido.';
  }

  return errors;
};

const hasValidationErrors = (errors) => Object.keys(errors).length > 0;

const ClienteFormModal = ({
  errors = {},
  error,
  form,
  isOpen,
  isSubmitting,
  mode,
  onChange,
  onClose,
  onSubmit,
}) => {
  const nombreRef = useRef(null);
  const identificacionRef = useRef(null);
  const telefonoRef = useRef(null);
  const correoRef = useRef(null);
  const trimmedName = form.nombre.trim();
  const isNameTooLong = trimmedName.length > MAX_NOMBRE_LENGTH;
  const isInvalid = !trimmedName || isNameTooLong || isSubmitting;
  const nombreDescribedBy = ['cliente-nombre-help', errors.nombre ? 'cliente-nombre-error' : '']
    .filter(Boolean)
    .join(' ');
  const identificacionDescribedBy = errors.identificacion
    ? 'cliente-identificacion-error'
    : undefined;
  const telefonoDescribedBy = errors.telefono ? 'cliente-telefono-error' : undefined;
  const correoDescribedBy = errors.correo ? 'cliente-correo-error' : undefined;

  useEffect(() => {
    if (!isOpen || !hasValidationErrors(errors)) return;
    if (errors.nombre) {
      nombreRef.current?.focus();
      return;
    }
    if (errors.identificacion) {
      identificacionRef.current?.focus();
      return;
    }
    if (errors.telefono) {
      telefonoRef.current?.focus();
      return;
    }
    if (errors.correo) correoRef.current?.focus();
  }, [errors, isOpen]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      title={mode === 'edit' ? 'Editar cliente' : 'Crear cliente'}
      size="md"
      className="configuracion-cliente-modal"
      closeButtonDisabled={isSubmitting}
    >
      <form onSubmit={onSubmit} aria-busy={isSubmitting}>
        <AppModal.Header />
        <AppModal.Body aria-busy={isSubmitting}>
          {error && <div className="error-message">{error}</div>}
          <div className="configuracion-form-grid">
            <div className="form-group configuracion-form-span-2">
              <label htmlFor="cliente-nombre">Nombre</label>
              <input
                ref={nombreRef}
                id="cliente-nombre"
                type="text"
                value={form.nombre}
                maxLength={MAX_NOMBRE_LENGTH + 1}
                onChange={(event) => onChange({ nombre: event.target.value })}
                placeholder="Ej: Cliente corporativo"
                disabled={isSubmitting}
                autoFocus
                aria-invalid={Boolean(errors.nombre)}
                aria-describedby={nombreDescribedBy}
              />
              <div className="configuracion-field-meta">
                <span id="cliente-nombre-help">Nombre obligatorio.</span>
                <span>{trimmedName.length}/100</span>
              </div>
              {errors.nombre && (
                <span id="cliente-nombre-error" className="field-error">
                  {errors.nombre}
                </span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="cliente-tipo-identificacion">Tipo identificación</label>
              <select
                id="cliente-tipo-identificacion"
                value={form.tipo_identificacion}
                onChange={(event) => onChange({ tipo_identificacion: event.target.value })}
                disabled={isSubmitting}
              >
                <option value="">Selecciona un tipo</option>
                {TIPO_IDENTIFICACION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="cliente-identificacion">Identificación</label>
              <input
                ref={identificacionRef}
                id="cliente-identificacion"
                type="text"
                value={form.identificacion}
                onChange={(event) => onChange({ identificacion: event.target.value })}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.identificacion)}
                aria-describedby={identificacionDescribedBy}
              />
              {errors.identificacion && (
                <span id="cliente-identificacion-error" className="field-error">
                  {errors.identificacion}
                </span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="cliente-telefono">Teléfono</label>
              <input
                ref={telefonoRef}
                id="cliente-telefono"
                type="text"
                value={form.telefono}
                onChange={(event) => onChange({ telefono: event.target.value })}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.telefono)}
                aria-describedby={telefonoDescribedBy}
              />
              {errors.telefono && (
                <span id="cliente-telefono-error" className="field-error">
                  {errors.telefono}
                </span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="cliente-correo">Correo</label>
              <input
                ref={correoRef}
                id="cliente-correo"
                type="email"
                value={form.correo}
                onChange={(event) => onChange({ correo: event.target.value })}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.correo)}
                aria-describedby={correoDescribedBy}
              />
              {errors.correo && (
                <span id="cliente-correo-error" className="field-error">
                  {errors.correo}
                </span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="cliente-ciudad">Ciudad</label>
              <input
                id="cliente-ciudad"
                type="text"
                value={form.ciudad}
                onChange={(event) => onChange({ ciudad: event.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="cliente-estado">Estado</label>
              <select
                id="cliente-estado"
                value={form.estado}
                onChange={(event) => onChange({ estado: event.target.value })}
                disabled={isSubmitting}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div className="form-group configuracion-form-span-2">
              <label htmlFor="cliente-direccion">Dirección</label>
              <input
                id="cliente-direccion"
                type="text"
                value={form.direccion}
                onChange={(event) => onChange({ direccion: event.target.value })}
                disabled={isSubmitting}
              />
            </div>
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
                : 'Crear cliente'}
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

const formatUbicacionesCount = (value) => {
  const count = Number(value) || 0;
  if (count === 0) return 'Sin ubicaciones';
  return `${count} ${count === 1 ? 'ubicación' : 'ubicaciones'}`;
};

const getDisplayValue = (value) => {
  const normalized = String(value || '').trim();
  return normalized || 'Sin registrar';
};

const ClientesCatalog = ({
  ubicaciones = [],
  createRequestToken = 0,
  refreshToken = 0,
  permissions = {},
  onClientesLoaded,
  onCreateUbicacionForCliente,
  onClientesChanged,
  onManageUbicaciones,
}) => {
  const {
    canCreateCliente = false,
    canEditCliente = false,
    canDeleteCliente = false,
    canViewUbicaciones = false,
    canCreateUbicacion = false,
  } = permissions;
  const { showToast } = useToast();
  const [clientes, setClientes] = useState([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filtersDraft, setFiltersDraft] = useState({
    search: '',
    ubicacionId: '',
    estadoUbicaciones: 'todas',
  });
  const [filters, setFilters] = useState({
    search: '',
    ubicacionId: '',
    estadoUbicaciones: 'todas',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [modalMode, setModalMode] = useState(null);
  const [editingCliente, setEditingCliente] = useState(null);
  const [form, setForm] = useState(EMPTY_CLIENTE_FORM);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedUbicaciones = useMemo(
    () =>
      [...ubicaciones].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        })
      ),
    [ubicaciones]
  );

  const hasAppliedFilters = useMemo(
    () =>
      Boolean(
        filters.search.trim() || filters.ubicacionId || filters.estadoUbicaciones !== 'todas'
      ),
    [filters]
  );
  const hasActionsColumn = canEditCliente || canDeleteCliente;
  const tableColSpan = 7 + (canViewUbicaciones ? 1 : 0) + (hasActionsColumn ? 1 : 0);
  const isGlobalEmpty = pagination.totalItems === 0 && !hasAppliedFilters;
  const emptyMessage = useMemo(() => {
    if (isGlobalEmpty) return 'No hay clientes registrados.';
    if (filters.estadoUbicaciones === 'con_ubicaciones') {
      return 'No hay clientes con ubicaciones que coincidan con los filtros aplicados.';
    }
    if (filters.estadoUbicaciones === 'sin_ubicaciones') {
      return 'No hay clientes sin ubicaciones que coincidan con los filtros aplicados.';
    }
    return 'No encontramos clientes que coincidan con los filtros aplicados.';
  }, [filters.estadoUbicaciones, isGlobalEmpty]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pagination.totalPages || 1));
  }, [pagination.totalPages]);

  useEffect(() => {
    if (
      filtersDraft.ubicacionId &&
      !sortedUbicaciones.some(
        (ubicacion) => String(ubicacion.id) === String(filtersDraft.ubicacionId)
      )
    ) {
      setFiltersDraft((prev) => ({ ...prev, ubicacionId: '' }));
      setFilters((prev) => ({ ...prev, ubicacionId: '' }));
    }
  }, [filtersDraft.ubicacionId, sortedUbicaciones]);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const params = {
      page: currentPage,
      pageSize: DEFAULT_PAGINATION.pageSize,
    };
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.ubicacionId) params.ubicacionId = filters.ubicacionId;
    if (filters.estadoUbicaciones !== 'todas') params.estadoUbicaciones = filters.estadoUbicaciones;

    const result = await clientesService.listClientes(params);
    if (result.success) {
      const nextClientes = result.data || [];
      setClientes(nextClientes);
      setPagination(result.pagination);
      onClientesLoaded?.(nextClientes, result.pagination.totalItems);
    } else {
      setLoadError(result.message || 'Error al cargar clientes');
    }
    setLoading(false);
  }, [currentPage, filters, onClientesLoaded]);

  useEffect(() => {
    void loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    if (refreshToken > 0) {
      void loadClientes();
    }
  }, [loadClientes, refreshToken]);

  const resetModal = () => {
    setModalMode(null);
    setEditingCliente(null);
    setForm(EMPTY_CLIENTE_FORM);
    setFormError('');
    setFormErrors({});
  };

  const closeModal = () => {
    if (isSubmitting) return;
    resetModal();
  };

  const openCreateModal = useCallback(() => {
    setModalMode('create');
    setEditingCliente(null);
    setForm(EMPTY_CLIENTE_FORM);
    setFormError('');
    setFormErrors({});
  }, []);

  useEffect(() => {
    if (createRequestToken > 0) {
      openCreateModal();
    }
  }, [createRequestToken, openCreateModal]);

  const openEditModal = (cliente) => {
    setModalMode('edit');
    setEditingCliente(cliente);
    setForm({
      nombre: cliente.nombre || '',
      tipo_identificacion: cliente.tipo_identificacion || '',
      identificacion: cliente.identificacion || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      direccion: cliente.direccion || '',
      ciudad: cliente.ciudad || '',
      estado: cliente.estado || 'activo',
    });
    setFormError('');
    setFormErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const payload = trimClientePayload(form);
    const nextErrors = validateClientePayload(payload);
    if (hasValidationErrors(nextErrors)) {
      setFormErrors(nextErrors);
      setFormError('');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    setFormErrors({});
    try {
      const result =
        modalMode === 'edit'
          ? await clientesService.updateCliente(editingCliente.id, payload)
          : await clientesService.createCliente(payload);

      if (!result.success) {
        setFormError(
          getBackendErrorMessage(
            result,
            modalMode === 'edit' ? 'Error al actualizar cliente' : 'Error al crear cliente'
          )
        );
        return;
      }

      showToast(
        modalMode === 'edit' ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente',
        'success'
      );
      resetModal();
      await loadClientes();
      if (onClientesChanged) await onClientesChanged();
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await clientesService.deleteCliente(deleteTarget.id);

      if (!result.success) {
        showToast(getVisibleErrorMessage(result, 'Error al eliminar cliente'), 'error');
        return;
      }

      showToast('Cliente eliminado exitosamente', 'success');
      setDeleteTarget(null);
      await loadClientes();
      if (onClientesChanged) await onClientesChanged();
    } finally {
      setIsDeleting(false);
    }
  };

  const applyFilters = () => {
    setCurrentPage(1);
    setFilters(filtersDraft);
  };

  const clearFilters = () => {
    const emptyFilters = {
      search: '',
      ubicacionId: '',
      estadoUbicaciones: 'todas',
    };
    setCurrentPage(1);
    setFiltersDraft(emptyFilters);
    setFilters(emptyFilters);
  };

  const handleSearchChange = (event) => {
    setFiltersDraft((prev) => ({ ...prev, search: event.target.value }));
  };

  const handleUbicacionesFilterChange = (event) => {
    setFiltersDraft((prev) => ({ ...prev, ubicacionId: event.target.value }));
  };

  const handleEstadoUbicacionesChange = (event) => {
    setFiltersDraft((prev) => ({ ...prev, estadoUbicaciones: event.target.value }));
  };

  const handleCreateUbicacionFromEmptyFilter = () => {
    const selectedCliente =
      pagination.totalItems === 1 && clientes.length === 1 ? clientes[0] : null;
    onCreateUbicacionForCliente?.(selectedCliente);
  };

  return (
    <>
      <section className="tab-content configuracion-content tabular-workspace" aria-busy={loading}>
        <div className="ff-filter-row configuracion-clientes-filter-row">
          <div className="ff-filter-card configuracion-clientes-filter-card">
            <div className="ff-controls">
              <div className="configuracion-clientes-search-field">
                <label className="ff-state-label" htmlFor="clientes-search">
                  Buscar
                </label>
                <div className="ff-search configuracion-clientes-search">
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
                    id="clientes-search"
                    type="search"
                    value={filtersDraft.search}
                    onChange={handleSearchChange}
                    onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
                    placeholder="Buscar por nombre, identificación, correo o teléfono."
                  />
                </div>
              </div>
              <div className="ff-state configuracion-clientes-state">
                <label className="ff-state-label" htmlFor="clientes-ubicaciones">
                  Ubicaciones
                </label>
                <select
                  id="clientes-ubicaciones"
                  value={filtersDraft.ubicacionId}
                  onChange={handleUbicacionesFilterChange}
                >
                  <option value="">Todas las ubicaciones</option>
                  {sortedUbicaciones.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {ubicacion.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ff-state configuracion-clientes-relation">
                <label className="ff-state-label" htmlFor="clientes-estado-ubicaciones">
                  Relación
                </label>
                <select
                  id="clientes-estado-ubicaciones"
                  value={filtersDraft.estadoUbicaciones}
                  onChange={handleEstadoUbicacionesChange}
                >
                  <option value="todas">Todos los clientes</option>
                  <option value="con_ubicaciones">Con ubicaciones</option>
                  <option value="sin_ubicaciones">Sin ubicaciones</option>
                </select>
              </div>
            </div>
          </div>
          <div className="ff-filter-actions-card configuracion-filter-actions-card">
            <div className="ff-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={applyFilters}>
                Aplicar
              </button>
              <button className="ff-clear-btn" type="button" onClick={clearFilters}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {filters.estadoUbicaciones === 'sin_ubicaciones' && canCreateUbicacion && (
          <div className="configuracion-filter-context">
            <span>Estos clientes todavía no tienen ubicaciones registradas.</span>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={handleCreateUbicacionFromEmptyFilter}
            >
              Crear ubicación
            </button>
          </div>
        )}

        {loadError && (
          <div className="error-message configuracion-load-error">
            <span>{loadError}</span>
            <button className="btn btn-danger btn-sm" type="button" onClick={loadClientes}>
              Reintentar
            </button>
          </div>
        )}

        {loading && clientes.length === 0 ? (
          <div className="loading-spinner-wrap" role="status">
            <span className="spinner" />
            <span>Cargando clientes...</span>
          </div>
        ) : (
          <>
            <LoadingState
              loading={loading}
              hasRows={clientes.length > 0}
              refreshMessage="Actualizando clientes…"
            />
            <div className="table-result-count" role="status" aria-live="polite">
              Mostrando {clientes.length} de {pagination.totalItems} cliente(s)
            </div>
            <div className="table-responsive app-table-shell configuracion-clientes-table-shell">
              <table className="app-table configuracion-clientes-table">
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Identificación</th>
                    <th scope="col">Teléfono</th>
                    <th scope="col">Correo electrónico</th>
                    <th scope="col">Dirección</th>
                    <th scope="col">Ciudad</th>
                    <th scope="col">Estado</th>
                    {canViewUbicaciones && <th scope="col">Ubicaciones</th>}
                    {hasActionsColumn && (
                      <th
                        scope="col"
                        className="app-col-actions"
                        aria-label="Acciones disponibles"
                      />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {clientes.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={tableColSpan}>
                        <div className="configuracion-empty-state" role="status">
                          <span>{emptyMessage}</span>
                          {isGlobalEmpty && canCreateCliente ? (
                            <button
                              className="btn btn-primary btn-sm"
                              type="button"
                              onClick={openCreateModal}
                            >
                              Crear cliente
                            </button>
                          ) : !isGlobalEmpty ? (
                            <button className="ff-clear-btn" type="button" onClick={clearFilters}>
                              Limpiar filtros
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    clientes.map((cliente, index) => (
                      <tr key={cliente.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td
                          className="configuracion-text-strong"
                          title={getDisplayValue(cliente.nombre)}
                        >
                          {getDisplayValue(cliente.nombre)}
                        </td>
                        <td
                          className="configuracion-cell-identificacion"
                          title={getDisplayValue(cliente.identificacion)}
                        >
                          {getDisplayValue(cliente.identificacion)}
                        </td>
                        <td title={getDisplayValue(cliente.telefono)}>
                          {getDisplayValue(cliente.telefono)}
                        </td>
                        <td title={getDisplayValue(cliente.correo)}>
                          {getDisplayValue(cliente.correo)}
                        </td>
                        <td title={getDisplayValue(cliente.direccion)}>
                          {getDisplayValue(cliente.direccion)}
                        </td>
                        <td title={getDisplayValue(cliente.ciudad)}>
                          {getDisplayValue(cliente.ciudad)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              cliente.estado === 'inactivo' ? 'badge-inactive' : 'badge-active'
                            }`}
                          >
                            {cliente.estado === 'inactivo' ? 'Inactivo' : 'Activo'}
                          </span>
                        </td>
                        {canViewUbicaciones && (
                          <td>
                            <button
                              className="configuracion-link-button"
                              type="button"
                              onClick={() => onManageUbicaciones?.(cliente)}
                            >
                              {formatUbicacionesCount(cliente.ubicaciones_totales)}
                            </button>
                          </td>
                        )}
                        {hasActionsColumn && (
                          <td className="app-col-actions app-col-actions--double">
                            <div className="action-buttons app-table-actions">
                              {canEditCliente && (
                                <button
                                  className="action-btn action-btn-edit"
                                  type="button"
                                  onClick={() => openEditModal(cliente)}
                                  title="Editar cliente"
                                  aria-label={`Editar cliente ${cliente.nombre}`}
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
                              {canDeleteCliente && (
                                <button
                                  className="action-btn action-btn-del"
                                  type="button"
                                  onClick={() => setDeleteTarget(cliente)}
                                  title="Eliminar cliente"
                                  aria-label={`Eliminar cliente ${cliente.nombre}`}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {clientes.length > 0 && (
              <div className="records-mobile configuracion-clientes-mobile-list">
                {clientes.map((cliente) => (
                  <article key={cliente.id} className="record-card configuracion-cliente-card">
                    <div className="record-card-header">
                      <div className="configuracion-cliente-card-title">
                        <h3>{getDisplayValue(cliente.nombre)}</h3>
                        <span>{getDisplayValue(cliente.identificacion)}</span>
                      </div>
                      <span
                        className={`badge ${
                          cliente.estado === 'inactivo' ? 'badge-inactive' : 'badge-active'
                        }`}
                      >
                        {cliente.estado === 'inactivo' ? 'Inactivo' : 'Activo'}
                      </span>
                    </div>
                    <dl className="record-card-details configuracion-cliente-card-details">
                      <div>
                        <dt>Correo</dt>
                        <dd>{getDisplayValue(cliente.correo)}</dd>
                      </div>
                      <div>
                        <dt>Teléfono</dt>
                        <dd>{getDisplayValue(cliente.telefono)}</dd>
                      </div>
                      <div>
                        <dt>Ciudad</dt>
                        <dd>{getDisplayValue(cliente.ciudad)}</dd>
                      </div>
                      {canViewUbicaciones && (
                        <div>
                          <dt>Ubicaciones</dt>
                          <dd>{formatUbicacionesCount(cliente.ubicaciones_totales)}</dd>
                        </div>
                      )}
                    </dl>
                    {hasActionsColumn && (
                      <div className="record-card-actions configuracion-cliente-card-actions">
                        {canEditCliente && (
                          <button
                            className="action-btn action-btn-edit"
                            type="button"
                            onClick={() => openEditModal(cliente)}
                            title="Editar cliente"
                            aria-label={`Editar cliente ${cliente.nombre}`}
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
                        {canDeleteCliente && (
                          <button
                            className="action-btn action-btn-del"
                            type="button"
                            onClick={() => setDeleteTarget(cliente)}
                            title="Eliminar cliente"
                            aria-label={`Eliminar cliente ${cliente.nombre}`}
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
                    )}
                  </article>
                ))}
              </div>
            )}
            <PaginationControls
              page={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>

      <ClienteFormModal
        errors={formErrors}
        error={formError}
        form={form}
        isOpen={Boolean(modalMode)}
        isSubmitting={isSubmitting}
        mode={modalMode}
        onChange={(nextForm) => {
          setForm((prev) => ({ ...prev, ...nextForm }));
          setFormError('');
          setFormErrors((prev) => {
            const nextErrors = { ...prev };
            Object.keys(nextForm).forEach((fieldName) => {
              delete nextErrors[fieldName];
            });
            return nextErrors;
          });
        }}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Eliminar cliente"
        message={
          deleteTarget
            ? `Eliminarás el cliente "${deleteTarget.nombre}"${deleteTarget.identificacion ? ` (${deleteTarget.identificacion})` : ''}. Solo puede eliminarse si no tiene relaciones; si tiene historial, desactívalo para conservar sus registros. Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar cliente"
        processingText="Eliminando..."
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default ClientesCatalog;
