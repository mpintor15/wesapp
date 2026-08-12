import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usuariosService from '../../services/usuariosService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import ConfirmDialog from '../../components/ConfirmDialog';
import { can } from '../../auth/authorization';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import UsuarioCreateModal from './components/UsuarioCreateModal';
import UsuarioEditModal from './components/UsuarioEditModal';
import UsuarioInvitationModal from './components/UsuarioInvitationModal';
import UsuariosFilters from './components/UsuariosFilters';
import UsuariosMobileCards from './components/UsuariosMobileCards';
import UsuariosPageHeader from './components/UsuariosPageHeader';
import UsuariosTable from './components/UsuariosTable';
import {
  buildFilterParams,
  buildUsuarioPayload,
  buildInvitationMessage,
  EMPTY_CREATE_USER_FORM,
  EMPTY_EDIT_USER_FORM,
  EMPTY_USUARIOS_FILTERS,
  fullName,
  getEditUserFormData,
  getNextSortState,
  sortByField,
  validateCreateForm,
} from './utils/usuariosHelpers';
import './Usuarios.css';

const Usuarios = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradoresLoading, setColaboradoresLoading] = useState(false);
  const [colaboradoresError, setColaboradoresError] = useState('');
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionesLoading, setUbicacionesLoading] = useState(false);
  const [ubicacionesError, setUbicacionesError] = useState('');
  const [filters, setFilters] = useState(EMPTY_USUARIOS_FILTERS);
  const [filtersDraft, setFiltersDraft] = useState(EMPTY_USUARIOS_FILTERS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [invitationData, setInvitationData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_CREATE_USER_FORM);
  const [createErrors, setCreateErrors] = useState({});
  const [editData, setEditData] = useState(EMPTY_EDIT_USER_FORM);
  const [tableSort, setTableSort] = useState({ field: 'apellido', direction: 'asc' });
  const { isSubmitting: isCreating, withSubmit: withCreateSubmit } = useSubmitState();
  const { isSubmitting: isSaving, withSubmit: withSaveSubmit } = useSubmitState();

  const loadUsuarios = useCallback(
    async (params = {}) => {
      setLoading(true);
      const res = await usuariosService.getUsuarios(params);
      if (res.success) {
        setUsuarios(res.data);
      } else {
        showToast(res.message, 'error');
      }
      setLoading(false);
    },
    [showToast]
  );

  useEffect(() => {
    loadUsuarios(buildFilterParams(filters));
  }, [filters, loadUsuarios]);

  const refreshUsuarios = useCallback(() => {
    loadUsuarios(buildFilterParams(filters));
  }, [filters, loadUsuarios]);

  const loadColaboradores = useCallback(async (usuarioId = null) => {
    setColaboradoresLoading(true);
    setColaboradoresError('');
    const result = await usuariosService.getColaboradoresElegibles(usuarioId);
    if (result.success) {
      setColaboradores(result.data);
    } else {
      setColaboradores([]);
      setColaboradoresError(result.message || 'No se pudieron cargar los colaboradores');
    }
    setColaboradoresLoading(false);
  }, []);

  const loadUbicaciones = useCallback(async () => {
    setUbicacionesLoading(true);
    setUbicacionesError('');
    const result = await usuariosService.getUbicacionesAsignables();
    if (result.success) setUbicaciones(result.data);
    else {
      setUbicaciones([]);
      setUbicacionesError(result.message || 'No se pudieron cargar las ubicaciones');
    }
    setUbicacionesLoading(false);
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltersDraft((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => setFilters(filtersDraft);

  const clearFilters = () => {
    setFiltersDraft(EMPTY_USUARIOS_FILTERS);
    setFilters(EMPTY_USUARIOS_FILTERS);
  };

  const handleTableSort = (field) => {
    setTableSort((prev) => getNextSortState(prev, field));
  };

  const sortedUsuarios = useMemo(
    () => sortByField(usuarios, tableSort.field, tableSort.direction),
    [usuarios, tableSort]
  );
  const permissions = useMemo(
    () => ({
      canCreate: can(user, PERMISSIONS.USUARIOS_CREAR),
      canEdit: can(user, PERMISSIONS.USUARIOS_EDITAR),
      canInvite: can(user, PERMISSIONS.USUARIOS_EDITAR),
      canDelete: can(user, PERMISSIONS.USUARIOS_ELIMINAR),
      canManageAssignments: can(user, PERMISSIONS.BITACORAS_ASIGNACIONES_ADMINISTRAR),
    }),
    [user]
  );

  const openCreate = () => {
    if (!permissions.canCreate) {
      showToast('No tienes permisos para crear usuarios', 'error');
      return;
    }
    setFormData(EMPTY_CREATE_USER_FORM);
    setCreateErrors({});
    setShowCreateModal(true);
    void loadColaboradores();
    if (permissions.canManageAssignments) void loadUbicaciones();
  };

  const openEdit = (usuario) => {
    if (!permissions.canEdit) {
      showToast('No tienes permisos para editar usuarios', 'error');
      return;
    }
    setSelectedUsuario(usuario);
    setEditData(getEditUserFormData(usuario));
    setShowEditModal(true);
    void loadColaboradores(usuario.id);
    if (permissions.canManageAssignments) void loadUbicaciones();
  };

  const handleCreateFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setCreateErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleEditFormChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = withCreateSubmit(async (e) => {
    e.preventDefault();
    const errors = validateCreateForm(formData);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }

    const result = await usuariosService.createUsuario(
      buildUsuarioPayload(formData, permissions.canManageAssignments)
    );
    if (result.success) {
      setShowCreateModal(false);
      setInvitationData({
        nombre: result.data.nombre,
        apellido: result.data.apellido,
        usuario: result.data.usuario,
        temp_password: result.data.temp_password,
      });
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleEdit = withSaveSubmit(async (e) => {
    e.preventDefault();
    if (!selectedUsuario) return;
    const result = await usuariosService.updateUsuario(
      selectedUsuario.id,
      buildUsuarioPayload(editData, permissions.canManageAssignments)
    );
    if (result.success) {
      showToast('Usuario actualizado', 'success');
      setShowEditModal(false);
      refreshUsuarios();
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget || isDeleting) return;
    if (!permissions.canDelete) {
      showToast('No tienes permisos para eliminar usuarios', 'error');
      setConfirmTarget(null);
      return;
    }
    setIsDeleting(true);
    try {
      const result = await usuariosService.deleteUsuario(confirmTarget.id);
      if (result.success) {
        showToast('Usuario eliminado', 'success');
        setConfirmTarget(null);
        refreshUsuarios();
      } else {
        showToast(getVisibleErrorMessage(result, 'Error al eliminar usuario'), 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReenviarInvitacion = async (usuario) => {
    if (!permissions.canInvite) {
      showToast('No tienes permisos para reenviar invitaciones', 'error');
      return;
    }
    const result = await usuariosService.reenviarInvitacion(usuario.id);
    if (result.success) {
      setInvitationData({
        nombre: result.data.nombre,
        apellido: result.data.apellido,
        usuario: result.data.usuario,
        temp_password: result.data.temp_password,
      });
      showToast(result.message || 'Invitación regenerada', 'success');
      refreshUsuarios();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleCopyInvitation = async () => {
    if (!invitationData) return;
    const msg = buildInvitationMessage(
      invitationData.nombre,
      invitationData.apellido,
      invitationData.usuario,
      invitationData.temp_password
    );
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('No se pudo copiar. Copia el mensaje manualmente.', 'error');
    }
  };

  const closeInvitation = () => {
    setInvitationData(null);
    setCopied(false);
    refreshUsuarios();
  };

  return (
    <div className="page-container">
      <UsuariosPageHeader
        canCreate={permissions.canCreate}
        onBack={() => navigate('/')}
        onCreate={openCreate}
        onRefresh={refreshUsuarios}
      />

      <UsuariosFilters
        filtersDraft={filtersDraft}
        onApply={applyFilters}
        onChange={handleFilterChange}
        onClear={clearFilters}
      />

      {/* Table */}
      {loading ? (
        <div className="loading-spinner-wrap">
          <span className="spinner" />
          <span>Cargando usuarios…</span>
        </div>
      ) : (
        <>
          <div className="table-result-count">Mostrando {sortedUsuarios.length} usuario(s)</div>

          <UsuariosTable
            canDelete={permissions.canDelete}
            canEdit={permissions.canEdit}
            canInvite={permissions.canInvite}
            onDelete={setConfirmTarget}
            onEdit={openEdit}
            onInvite={handleReenviarInvitacion}
            onSort={handleTableSort}
            tableSort={tableSort}
            usuarios={sortedUsuarios}
          />
        </>
      )}

      {/* Mobile cards */}
      {!loading && sortedUsuarios.length > 0 && (
        <UsuariosMobileCards
          canDelete={permissions.canDelete}
          canEdit={permissions.canEdit}
          canInvite={permissions.canInvite}
          onDelete={setConfirmTarget}
          onEdit={openEdit}
          onInvite={handleReenviarInvitacion}
          usuarios={sortedUsuarios}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <UsuarioCreateModal
          createErrors={createErrors}
          colaboradores={colaboradores}
          colaboradoresError={colaboradoresError}
          colaboradoresLoading={colaboradoresLoading}
          formData={formData}
          isCreating={isCreating}
          canManageAssignments={permissions.canManageAssignments}
          ubicaciones={ubicaciones}
          ubicacionesError={ubicacionesError}
          ubicacionesLoading={ubicacionesLoading}
          onCancel={() => setShowCreateModal(false)}
          onChange={handleCreateFormChange}
          onSubmit={handleCreate}
        />
      )}

      {/* Invitation modal */}
      {invitationData && (
        <UsuarioInvitationModal
          copied={copied}
          invitationData={invitationData}
          onClose={closeInvitation}
          onCopy={handleCopyInvitation}
        />
      )}

      {/* Edit modal */}
      {showEditModal && selectedUsuario && (
        <UsuarioEditModal
          editData={editData}
          colaboradores={colaboradores}
          colaboradoresError={colaboradoresError}
          colaboradoresLoading={colaboradoresLoading}
          isSaving={isSaving}
          canManageAssignments={permissions.canManageAssignments}
          ubicaciones={ubicaciones}
          ubicacionesError={ubicacionesError}
          ubicacionesLoading={ubicacionesLoading}
          onCancel={() => setShowEditModal(false)}
          onChange={handleEditFormChange}
          onSubmit={handleEdit}
          selectedUsuario={selectedUsuario}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Eliminar usuario"
        message={
          confirmTarget
            ? `Eliminarás al usuario "${fullName(confirmTarget)}" con rol "${confirmTarget.tipo_usuario}". Los usuarios con actividad deben desactivarse para conservar el historial. Esta acción no se puede deshacer cuando sea permitida.`
            : ''
        }
        confirmText="Eliminar usuario"
        processingText="Eliminando..."
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isDeleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

export default Usuarios;
