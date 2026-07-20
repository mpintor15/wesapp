import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppModal from '../../components/AppModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import inventarioService from '../../services/inventarioService';
import {
  getInventoryPermissions,
  INVENTORY_ACTIONS,
} from '../Inventario/utils/inventarioPermissions';
import './Configuracion.css';

const EMPTY_FORM = { nombre: '' };
const MAX_NOMBRE_LENGTH = 100;

const normalizeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeUbicacion = (ubicacion) => ({
  ...ubicacion,
  articulos_activos: normalizeCount(ubicacion?.articulos_activos),
  articulos_totales: normalizeCount(ubicacion?.articulos_totales),
});

const getBackendErrorMessage = (result, fallback) =>
  result?.status === 409
    ? result.message || 'Ya existe una ubicación con ese nombre.'
    : result?.message || fallback;

const UbicacionFormModal = ({
  error,
  form,
  isOpen,
  isSubmitting,
  mode,
  onChange,
  onClose,
  onSubmit,
}) => {
  const trimmedName = form.nombre.trim();
  const isNameTooLong = trimmedName.length > MAX_NOMBRE_LENGTH;
  const isInvalid = !trimmedName || isNameTooLong || isSubmitting;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      title={mode === 'edit' ? 'Editar ubicación' : 'Crear ubicación'}
      size="sm"
      className="configuracion-ubicacion-modal"
    >
      <form onSubmit={onSubmit}>
        <AppModal.Header />
        <AppModal.Body>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="ubicacion-nombre">Nombre</label>
            <input
              id="ubicacion-nombre"
              type="text"
              value={form.nombre}
              maxLength={MAX_NOMBRE_LENGTH + 1}
              onChange={(event) => onChange({ nombre: event.target.value })}
              placeholder="Ej: Bodega principal"
              disabled={isSubmitting}
              autoFocus
            />
            <div className="configuracion-field-meta">
              <span>
                {isNameTooLong ? `Máximo ${MAX_NOMBRE_LENGTH} caracteres.` : 'Nombre obligatorio.'}
              </span>
              <span>{trimmedName.length}/100</span>
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const permissions = useMemo(() => getInventoryPermissions(user), [user]);

  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [editingUbicacion, setEditingUbicacion] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canCreate = permissions.can(INVENTORY_ACTIONS.ARTICULOS_CREATE);
  const canEdit = permissions.can(INVENTORY_ACTIONS.ARTICULOS_EDIT);
  const canDelete = permissions.can(INVENTORY_ACTIONS.ARTICULOS_DELETE_ADMIN);

  const loadUbicaciones = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const result = await inventarioService.getUbicaciones();
    if (result.success) {
      setUbicaciones((result.data || []).map(normalizeUbicacion));
    } else {
      setLoadError(result.message || 'Error al cargar ubicaciones');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUbicaciones();
  }, [loadUbicaciones]);

  const resetModal = () => {
    setModalMode(null);
    setEditingUbicacion(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const closeModal = () => {
    if (isSubmitting) return;
    resetModal();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUbicacion(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const openEditModal = (ubicacion) => {
    setModalMode('edit');
    setEditingUbicacion(ubicacion);
    setForm({ nombre: ubicacion.nombre || '' });
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nombre = form.nombre.trim();
    if (!nombre) {
      setFormError('El nombre de la ubicación es obligatorio.');
      return;
    }
    if (nombre.length > MAX_NOMBRE_LENGTH) {
      setFormError(`El nombre no puede exceder ${MAX_NOMBRE_LENGTH} caracteres.`);
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    const result =
      modalMode === 'edit'
        ? await inventarioService.updateUbicacion(editingUbicacion.id, { nombre })
        : await inventarioService.createUbicacion({ nombre });
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(
        getBackendErrorMessage(
          result,
          modalMode === 'edit' ? 'Error al actualizar ubicación' : 'Error al crear ubicación'
        )
      );
      return;
    }

    const next = normalizeUbicacion(result.data || { ...editingUbicacion, nombre });
    setUbicaciones((prev) =>
      modalMode === 'edit'
        ? prev.map((ubicacion) =>
            ubicacion.id === next.id ? { ...ubicacion, ...next } : ubicacion
          )
        : [...prev, next].sort((a, b) =>
            String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {
              sensitivity: 'base',
              numeric: true,
            })
          )
    );
    showToast(
      modalMode === 'edit' ? 'Ubicación actualizada exitosamente' : 'Ubicación creada exitosamente',
      'success'
    );
    resetModal();
  };

  const requestDelete = (ubicacion) => {
    if (normalizeCount(ubicacion.articulos_totales) > 0) return;
    setDeleteTarget(ubicacion);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    const result = await inventarioService.deleteUbicacion(deleteTarget.id);
    setIsDeleting(false);

    if (!result.success) {
      showToast(result.message || 'Error al eliminar ubicación', 'error');
      return;
    }

    setUbicaciones((prev) => prev.filter((ubicacion) => ubicacion.id !== deleteTarget.id));
    showToast('Ubicación eliminada exitosamente', 'success');
    setDeleteTarget(null);
  };

  const totalActivos = ubicaciones.reduce(
    (sum, ubicacion) => sum + normalizeCount(ubicacion.articulos_activos),
    0
  );
  const totalArticulos = ubicaciones.reduce(
    (sum, ubicacion) => sum + normalizeCount(ubicacion.articulos_totales),
    0
  );

  return (
    <div className="configuracion-container">
      <header className="page-header">
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
            <h1>Configuración</h1>
            <p className="configuracion-breadcrumb">Catálogos / Ubicaciones</p>
          </div>
        </div>
        <div className="page-header-actions">
          {canCreate && (
            <button className="btn btn-ghost btn-sm" onClick={openCreateModal} type="button">
              Crear ubicación
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm btn-icon-only"
            onClick={loadUbicaciones}
            title="Actualizar datos"
            aria-label="Actualizar datos"
            type="button"
            disabled={loading}
          >
            ↻
          </button>
        </div>
      </header>

      <main>
        <div className="configuracion-tabs" aria-label="Catálogos de configuración">
          <button className="tab active" type="button">
            Ubicaciones
            {ubicaciones.length > 0 && <span className="tab-badge">{ubicaciones.length}</span>}
          </button>
        </div>

        <section className="tab-content configuracion-content">
          <div className="configuracion-summary" aria-label="Resumen de ubicaciones">
            <div>
              <span>Ubicaciones</span>
              <strong>{ubicaciones.length}</strong>
            </div>
            <div>
              <span>Artículos activos</span>
              <strong>{totalActivos}</strong>
            </div>
            <div>
              <span>Artículos totales</span>
              <strong>{totalArticulos}</strong>
            </div>
          </div>

          {loadError && (
            <div className="error-message configuracion-load-error">
              <span>{loadError}</span>
              <button className="btn btn-danger btn-sm" type="button" onClick={loadUbicaciones}>
                Reintentar
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading-spinner-wrap" role="status">
              <span className="spinner" />
              <span>Cargando ubicaciones...</span>
            </div>
          ) : (
            <>
              <div className="table-result-count">Mostrando {ubicaciones.length} ubicación(es)</div>
              <div className="table-responsive app-table-shell">
                <table className="app-table configuracion-ubicaciones-table">
                  <thead>
                    <tr>
                      <th>Ubicación</th>
                      <th>Artículos activos</th>
                      <th>Artículos totales</th>
                      {(canEdit || canDelete) && <th className="app-col-actions">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ubicaciones.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan={canEdit || canDelete ? 4 : 3}>
                          No hay ubicaciones registradas.
                        </td>
                      </tr>
                    ) : (
                      ubicaciones.map((ubicacion, index) => {
                        const total = normalizeCount(ubicacion.articulos_totales);
                        const deleteBlocked = total > 0;
                        return (
                          <tr
                            key={ubicacion.id}
                            className={index % 2 === 0 ? 'row-even' : 'row-odd'}
                          >
                            <td>{ubicacion.nombre}</td>
                            <td className="app-cell-qty">
                              {normalizeCount(ubicacion.articulos_activos)}
                            </td>
                            <td className="app-cell-qty">{total}</td>
                            {(canEdit || canDelete) && (
                              <td className="app-col-actions app-col-actions--double">
                                <div className="action-buttons app-table-actions">
                                  {canEdit && (
                                    <button
                                      className="action-btn action-btn-edit"
                                      type="button"
                                      onClick={() => openEditModal(ubicacion)}
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
                                  {canDelete && !deleteBlocked && (
                                    <button
                                      className="action-btn action-btn-del"
                                      type="button"
                                      onClick={() => requestDelete(ubicacion)}
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
                                  {canDelete && deleteBlocked && (
                                    <span
                                      className="configuracion-delete-blocked"
                                      title="No se puede eliminar una ubicación con artículos asociados"
                                      aria-label="Eliminación bloqueada por artículos asociados"
                                    >
                                      Bloqueada
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>

      <UbicacionFormModal
        error={formError}
        form={form}
        isOpen={Boolean(modalMode)}
        isSubmitting={isSubmitting}
        mode={modalMode}
        onChange={(nextForm) => {
          setForm(nextForm);
          setFormError('');
        }}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Eliminar ubicación"
        message={
          deleteTarget
            ? `¿Eliminar la ubicación "${deleteTarget.nombre}"? Esta acción no eliminará artículos.`
            : ''
        }
        confirmText={isDeleting ? 'Eliminando...' : 'Eliminar ubicación'}
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
};

export default Configuracion;
