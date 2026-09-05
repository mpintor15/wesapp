import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import personalService from '../../services/personalService';
import usuariosService from '../../services/usuariosService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingState from '../../components/LoadingState';
import PaginationControls from '../../components/PaginationControls';
import TabularWorkspace from '../../components/TabularWorkspace';
import { can } from '../../auth/authorization';
import { PERMISSIONS } from '../../auth/permissions';
import { ROLES } from '../../auth/rolePermissions';
import { useAuth } from '../../context/AuthContext';
import PersonalExportModal from './components/PersonalExportModal';
import PersonalFilters from './components/PersonalFilters';
import PersonalFormModal from './components/PersonalFormModal';
import PersonalMobileCards from './components/PersonalMobileCards';
import PersonalPageHeader from './components/PersonalPageHeader';
import PersonalTable from './components/PersonalTable';
import UsuarioCreateModal from './components/UsuarioCreateModal';
import UsuarioEditModal from './components/UsuarioEditModal';
import UsuarioInvitationModal from './components/UsuarioInvitationModal';
import { DEFAULT_PAGINATION, withPaginationParams } from '../../utils/pagination';
import {
  buildColaboradorPayload,
  buildPersonalExportParams,
  buildPersonalFilterParams,
  EMPTY_COLABORADOR_FORM,
  EMPTY_PERSONAL_EXPORT_FILTERS,
  EMPTY_PERSONAL_FILTERS,
  getColaboradorFormData,
  getNextSortState,
  getUniqueCargos,
  sortColaboradores,
  validateColaboradorForm,
} from './utils/personalHelpers';
import {
  buildUsuarioPayload,
  buildInvitationMessage,
  EMPTY_CREATE_USER_FORM,
  EMPTY_EDIT_USER_FORM,
  getEditUserFormData,
  validateCreateForm,
} from './utils/usuariosHelpers';
import './Personal.css';
import './components/usuarioAcceso.css';

const Personal = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [colaboradores, setColaboradores] = useState([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSubmitting: isSaving, withSubmit: withSaveSubmit } = useSubmitState();
  const { isSubmitting: isExporting, withSubmit: withExportSubmit } = useSubmitState();
  const [filters, setFilters] = useState(EMPTY_PERSONAL_FILTERS);
  const [exportFilters, setExportFilters] = useState(EMPTY_PERSONAL_EXPORT_FILTERS);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState(EMPTY_COLABORADOR_FORM);

  const [filtersDraft, setFiltersDraft] = useState(EMPTY_PERSONAL_FILTERS);
  const [tableSort, setTableSort] = useState({ field: 'nombres_completos', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  // Gestión de acceso (usuario asociado al colaborador)
  const [accesoColaborador, setAccesoColaborador] = useState(null);
  const [showAccesoCreateModal, setShowAccesoCreateModal] = useState(false);
  const [showAccesoEditModal, setShowAccesoEditModal] = useState(false);
  const [accesoColaboradores, setAccesoColaboradores] = useState([]);
  const [accesoColaboradoresLoading, setAccesoColaboradoresLoading] = useState(false);
  const [accesoColaboradoresError, setAccesoColaboradoresError] = useState('');
  const [accesoUbicaciones, setAccesoUbicaciones] = useState([]);
  const [accesoUbicacionesLoading, setAccesoUbicacionesLoading] = useState(false);
  const [accesoUbicacionesError, setAccesoUbicacionesError] = useState('');
  const [accesoCreateData, setAccesoCreateData] = useState(EMPTY_CREATE_USER_FORM);
  const [accesoCreateErrors, setAccesoCreateErrors] = useState({});
  const [accesoMode, setAccesoMode] = useState('crear');
  const [usuariosSinColaborador, setUsuariosSinColaborador] = useState([]);
  const [usuariosSinColaboradorLoading, setUsuariosSinColaboradorLoading] = useState(false);
  const [usuariosSinColaboradorError, setUsuariosSinColaboradorError] = useState('');
  const [accesoLinkUsuarioId, setAccesoLinkUsuarioId] = useState('');
  const [accesoLinkErrors, setAccesoLinkErrors] = useState({});
  const [accesoEditData, setAccesoEditData] = useState(EMPTY_EDIT_USER_FORM);
  const [accesoUsuarioId, setAccesoUsuarioId] = useState(null);
  const [invitationData, setInvitationData] = useState(null);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [revokeAccesoTarget, setRevokeAccesoTarget] = useState(null);
  const [isRevokingAcceso, setIsRevokingAcceso] = useState(false);
  const { isSubmitting: isCreatingAcceso, withSubmit: withCreateAccesoSubmit } = useSubmitState();
  const { isSubmitting: isSavingAcceso, withSubmit: withSaveAccesoSubmit } = useSubmitState();

  const loadColaboradores = useCallback(
    async (params = {}) => {
      setLoading(true);
      const res = await personalService.getColaboradores(params);
      if (res.success) {
        setColaboradores(res.data);
        setPagination(res.pagination);
      } else {
        showToast(res.message, 'error');
      }
      setLoading(false);
    },
    [showToast]
  );

  const loadCargos = useCallback(async () => {
    // Se pide el pageSize máximo permitido por el backend para poblar el
    // dropdown de cargos con la mayor cobertura posible sin cargar el
    // dataset completo: a la escala actual (decenas de colaboradores) cubre
    // el universo real de cargos.
    const res = await personalService.getColaboradores({ pageSize: 100 });
    if (res.success) {
      setCargos(getUniqueCargos(res.data));
    }
  }, []);

  useEffect(() => {
    loadCargos();
  }, [loadCargos]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadColaboradores(
        withPaginationParams({
          page: currentPage,
          pageSize: DEFAULT_PAGINATION.pageSize,
          filters: buildPersonalFilterParams(filters),
        })
      );
    }, 300);
    return () => clearTimeout(handler);
  }, [filters, currentPage, loadColaboradores]);

  const refreshColaboradores = useCallback(() => {
    loadColaboradores(
      withPaginationParams({
        page: currentPage,
        pageSize: DEFAULT_PAGINATION.pageSize,
        filters: buildPersonalFilterParams(filters),
      })
    );
  }, [filters, currentPage, loadColaboradores]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltersDraft((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFiltersDraft(EMPTY_PERSONAL_FILTERS);
    setFilters(EMPTY_PERSONAL_FILTERS);
    setCurrentPage(1);
  };

  const handleTableSort = (field) => {
    setTableSort((prev) => getNextSortState(prev, field));
  };

  // El sort ordena la página actual ya traída del servidor (mismo patrón
  // que Usuarios: server-side pagination + sort client-side sobre la página
  // visible), no el dataset completo.
  const sortedColaboradores = useMemo(() => {
    return sortColaboradores(colaboradores, tableSort);
  }, [colaboradores, tableSort]);

  const hasActiveFilters = Boolean(filters.search.trim() || filters.estado || filters.cargo);
  const emptyMessage = hasActiveFilters
    ? 'No hay colaboradores para los filtros aplicados'
    : 'No hay colaboradores registrados';

  const permissions = useMemo(
    () => ({
      canCreate: can(user, PERMISSIONS.PERSONAL_CREAR),
      canEdit: can(user, PERMISSIONS.PERSONAL_EDITAR),
      canDelete: can(user, PERMISSIONS.PERSONAL_ELIMINAR),
      canExport: can(user, PERMISSIONS.PERSONAL_REPORTES_EXPORTAR),
      // Banco, número de cuenta y sueldo son datos sensibles de nómina:
      // solo gerente y secretario pueden verlos o editarlos (regla de
      // negocio de la integración Usuarios→Personal). El backend aplica la
      // misma restricción de forma independiente; esto es solo UX.
      canViewSensitive: [ROLES.GERENTE, ROLES.SECRETARIO].includes(user?.tipo_usuario),
      canCreateAcceso: can(user, PERMISSIONS.USUARIOS_CREAR),
      canEditAcceso: can(user, PERMISSIONS.USUARIOS_EDITAR),
      canDeleteAcceso: can(user, PERMISSIONS.USUARIOS_ELIMINAR),
      canManageAssignments: can(user, PERMISSIONS.BITACORAS_ASIGNACIONES_ADMINISTRAR),
    }),
    [user]
  );
  const canManageAcceso = permissions.canCreateAcceso || permissions.canEditAcceso;

  const resetForm = () => setFormData(EMPTY_COLABORADOR_FORM);

  const openCreate = () => {
    if (!permissions.canCreate) {
      showToast('No tienes permisos para crear colaboradores', 'error');
      return;
    }
    setEditingColaborador(null);
    resetForm();
    setFormErrors({});
    setShowModal(true);
  };

  const openExportModal = () => {
    if (!permissions.canExport) {
      showToast('No tienes permisos para generar reportes de personal', 'error');
      return;
    }
    setExportFilters({
      estado: filters.estado,
      cargo: filters.cargo,
    });
    setShowExportModal(true);
  };

  const openEdit = (colaborador) => {
    if (!permissions.canEdit) {
      showToast('No tienes permisos para editar colaboradores', 'error');
      return;
    }
    setEditingColaborador(colaborador);
    setFormData(getColaboradorFormData(colaborador));
    setFormErrors({});
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSave = withSaveSubmit(async (e) => {
    e.preventDefault();
    const errors = validateColaboradorForm(formData, {
      isEditing: Boolean(editingColaborador),
      canAccessSensitive: permissions.canViewSensitive,
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }
    const payload = buildColaboradorPayload(formData);
    const result = editingColaborador
      ? await personalService.updateColaborador(editingColaborador.id, payload)
      : await personalService.createColaborador(payload);

    if (result.success) {
      showToast(editingColaborador ? 'Colaborador actualizado' : 'Colaborador creado', 'success');
      setShowModal(false);
      refreshColaboradores();
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget || isDeleting) return;
    if (!permissions.canDelete) {
      showToast('No tienes permisos para eliminar colaboradores', 'error');
      setConfirmTarget(null);
      return;
    }
    setIsDeleting(true);
    try {
      const result = await personalService.deleteColaborador(confirmTarget.id);
      if (result.success) {
        showToast('Colaborador eliminado', 'success');
        setConfirmTarget(null);
        refreshColaboradores();
      } else {
        showToast(getVisibleErrorMessage(result, 'Error al eliminar colaborador'), 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = withExportSubmit(async () => {
    const result = await personalService.exportExcel(buildPersonalExportParams(exportFilters));
    if (!result.success) showToast(result.message, 'error');
    setShowExportModal(false);
  });

  // ============================================
  // GESTIÓN DE ACCESO (usuario asociado al colaborador)
  // ============================================

  const loadAccesoColaboradores = useCallback(async (usuarioId = null) => {
    setAccesoColaboradoresLoading(true);
    setAccesoColaboradoresError('');
    const result = await usuariosService.getColaboradoresElegibles(usuarioId);
    if (result.success) {
      setAccesoColaboradores(result.data);
    } else {
      setAccesoColaboradores([]);
      setAccesoColaboradoresError(result.message || 'No se pudieron cargar los colaboradores');
    }
    setAccesoColaboradoresLoading(false);
  }, []);

  const loadUsuariosSinColaborador = useCallback(async () => {
    setUsuariosSinColaboradorLoading(true);
    setUsuariosSinColaboradorError('');
    const result = await usuariosService.getUsuariosSinColaborador();
    if (result.success) {
      setUsuariosSinColaborador(result.data);
    } else {
      setUsuariosSinColaborador([]);
      setUsuariosSinColaboradorError(result.message || 'No se pudieron cargar los usuarios');
    }
    setUsuariosSinColaboradorLoading(false);
  }, []);

  const loadAccesoUbicaciones = useCallback(async () => {
    setAccesoUbicacionesLoading(true);
    setAccesoUbicacionesError('');
    const result = await usuariosService.getUbicacionesAsignables();
    if (result.success) setAccesoUbicaciones(result.data);
    else {
      setAccesoUbicaciones([]);
      setAccesoUbicacionesError(result.message || 'No se pudieron cargar las ubicaciones');
    }
    setAccesoUbicacionesLoading(false);
  }, []);

  const openManageAcceso = async (colaborador) => {
    if (!canManageAcceso) {
      showToast('No tienes permisos para gestionar el acceso al sistema', 'error');
      return;
    }
    setAccesoColaborador(colaborador);

    if (!colaborador.acceso?.tiene_usuario) {
      if (!permissions.canCreateAcceso) {
        showToast('No tienes permisos para crear accesos', 'error');
        return;
      }
      setAccesoCreateData({
        ...EMPTY_CREATE_USER_FORM,
        colaborador_id: String(colaborador.id),
      });
      setAccesoCreateErrors({});
      setAccesoMode('crear');
      setAccesoLinkUsuarioId('');
      setAccesoLinkErrors({});
      setShowAccesoCreateModal(true);
      void loadAccesoColaboradores();
      if (permissions.canManageAssignments) void loadAccesoUbicaciones();
      // Vincular un usuario legacy (colaborador_id NULL) es técnicamente un
      // UPDATE (usuarios.editar), no una creación: solo se ofrece la opción
      // si el rol puede realmente completar esa operación en el backend.
      if (permissions.canEditAcceso) void loadUsuariosSinColaborador();
      return;
    }

    if (!permissions.canEditAcceso) {
      showToast('No tienes permisos para editar el acceso', 'error');
      return;
    }
    const result = await usuariosService.getUsuarioByColaborador(colaborador.id);
    if (!result.success || !result.data) {
      showToast(result.message || 'No se pudo cargar el usuario del colaborador', 'error');
      return;
    }
    setAccesoEditData(getEditUserFormData(result.data));
    setAccesoUsuarioId(result.data.id);
    setShowAccesoEditModal(true);
    void loadAccesoColaboradores(result.data.id);
    if (permissions.canManageAssignments) void loadAccesoUbicaciones();
  };

  const handleAccesoCreateChange = (field, value) => {
    setAccesoCreateData((prev) => ({ ...prev, [field]: value }));
    setAccesoCreateErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleAccesoModeChange = (nextMode) => {
    setAccesoMode(nextMode);
    setAccesoCreateErrors({});
    setAccesoLinkErrors({});
  };

  const handleAccesoLinkUsuarioChange = (value) => {
    setAccesoLinkUsuarioId(value);
    setAccesoLinkErrors({});
  };

  const handleAccesoEditChange = (field, value) => {
    setAccesoEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccesoLink = async () => {
    if (!permissions.canEditAcceso) {
      showToast('No tienes permisos para vincular accesos', 'error');
      return;
    }
    if (!accesoLinkUsuarioId) {
      const errors = { usuario_id: 'Selecciona un usuario' };
      setAccesoLinkErrors(errors);
      showToast(errors.usuario_id, 'error');
      return;
    }
    if (!accesoColaborador) return;
    const result = await usuariosService.updateUsuario(accesoLinkUsuarioId, {
      colaborador_id: accesoColaborador.id,
    });
    if (result.success) {
      showToast('Usuario vinculado exitosamente', 'success');
      setShowAccesoCreateModal(false);
      refreshColaboradores();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleAccesoCreate = withCreateAccesoSubmit(async (e) => {
    e.preventDefault();
    if (accesoMode === 'vincular') {
      await handleAccesoLink();
      return;
    }
    const errors = validateCreateForm(accesoCreateData);
    if (Object.keys(errors).length > 0) {
      setAccesoCreateErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }
    const result = await usuariosService.createUsuario(
      buildUsuarioPayload(accesoCreateData, permissions.canManageAssignments)
    );
    if (result.success) {
      setShowAccesoCreateModal(false);
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

  const handleAccesoEdit = withSaveAccesoSubmit(async (e) => {
    e.preventDefault();
    if (!accesoEditData.colaborador_id || !accesoUsuarioId) return;
    const result = await usuariosService.updateUsuario(
      accesoUsuarioId,
      buildUsuarioPayload(accesoEditData, permissions.canManageAssignments)
    );
    if (result.success) {
      showToast('Acceso actualizado', 'success');
      setShowAccesoEditModal(false);
      refreshColaboradores();
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleRevokeAccesoConfirmed = async () => {
    if (!revokeAccesoTarget || isRevokingAcceso) return;
    if (!permissions.canDeleteAcceso) {
      showToast('No tienes permisos para revocar accesos', 'error');
      setRevokeAccesoTarget(null);
      return;
    }
    setIsRevokingAcceso(true);
    try {
      const result = await usuariosService.deleteUsuario(revokeAccesoTarget.usuarioId);
      if (result.success) {
        showToast('Acceso revocado', 'success');
        setRevokeAccesoTarget(null);
        setShowAccesoEditModal(false);
        refreshColaboradores();
      } else {
        showToast(getVisibleErrorMessage(result, 'Error al revocar el acceso'), 'error');
      }
    } finally {
      setIsRevokingAcceso(false);
    }
  };

  const handleReenviarInvitacionAcceso = async () => {
    if (!accesoUsuarioId) return;
    const result = await usuariosService.reenviarInvitacion(accesoUsuarioId);
    if (result.success) {
      setShowAccesoEditModal(false);
      setInvitationData({
        nombre: accesoEditData.nombre,
        apellido: accesoEditData.apellido,
        usuario: result.data.usuario,
        temp_password: result.data.temp_password,
      });
      showToast(result.message || 'Invitación regenerada', 'success');
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
      setInvitationCopied(true);
      setTimeout(() => setInvitationCopied(false), 2500);
    } catch {
      showToast('No se pudo copiar. Copia el mensaje manualmente.', 'error');
    }
  };

  const closeInvitation = () => {
    setInvitationData(null);
    setInvitationCopied(false);
    refreshColaboradores();
  };

  return (
    <div className="page-container tabular-page">
      <PersonalPageHeader
        canCreate={permissions.canCreate}
        canExport={permissions.canExport}
        onBack={() => navigate('/')}
        onCreate={openCreate}
        onExport={openExportModal}
        onRefresh={refreshColaboradores}
      />

      <TabularWorkspace
        dataCard
        controls={
          <PersonalFilters
            cargos={cargos}
            filtersDraft={filtersDraft}
            onApply={applyFilters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        }
        summary={
          !(loading && sortedColaboradores.length === 0) ? (
            <div className="table-result-count">
              Mostrando {sortedColaboradores.length} de {pagination.totalItems} colaborador(es)
            </div>
          ) : null
        }
        pagination={
          !(loading && sortedColaboradores.length === 0) ? (
            <PaginationControls
              page={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
            />
          ) : null
        }
      >
        {loading && sortedColaboradores.length === 0 ? (
          <div className="loading-spinner-wrap">
            <span className="spinner" />
            <span>Cargando colaboradores…</span>
          </div>
        ) : (
          <>
            <LoadingState
              loading={loading}
              hasRows={sortedColaboradores.length > 0}
              refreshMessage="Actualizando colaboradores…"
            />
            <PersonalTable
              canDelete={permissions.canDelete}
              canEdit={permissions.canEdit}
              canManageAcceso={canManageAcceso}
              canViewSensitive={permissions.canViewSensitive}
              colaboradores={sortedColaboradores}
              emptyMessage={emptyMessage}
              onDelete={setConfirmTarget}
              onEdit={openEdit}
              onManageAcceso={openManageAcceso}
              onSort={handleTableSort}
              paginatedColaboradores={sortedColaboradores}
              tableSort={tableSort}
            />
            {sortedColaboradores.length > 0 && (
              <PersonalMobileCards
                canDelete={permissions.canDelete}
                canEdit={permissions.canEdit}
                canManageAcceso={canManageAcceso}
                canViewSensitive={permissions.canViewSensitive}
                colaboradores={sortedColaboradores}
                onDelete={setConfirmTarget}
                onEdit={openEdit}
                onManageAcceso={openManageAcceso}
              />
            )}
          </>
        )}
      </TabularWorkspace>

      {/* Create / Edit modal */}
      {showModal && (
        <PersonalFormModal
          canViewSensitive={permissions.canViewSensitive}
          editingColaborador={editingColaborador}
          formData={formData}
          formErrors={formErrors}
          isSaving={isSaving}
          onCancel={() => setShowModal(false)}
          onChange={handleFormChange}
          onSubmit={handleSave}
        />
      )}

      {/* Crear acceso */}
      {showAccesoCreateModal && (
        <UsuarioCreateModal
          createErrors={accesoCreateErrors}
          colaboradores={accesoColaboradores}
          colaboradoresError={accesoColaboradoresError}
          colaboradoresLoading={accesoColaboradoresLoading}
          formData={accesoCreateData}
          isCreating={isCreatingAcceso}
          canManageAssignments={permissions.canManageAssignments}
          lockColaborador
          linkErrors={accesoLinkErrors}
          linkUsuarioId={accesoLinkUsuarioId}
          mode={accesoMode}
          showLinkOption={permissions.canEditAcceso}
          ubicaciones={accesoUbicaciones}
          ubicacionesError={accesoUbicacionesError}
          ubicacionesLoading={accesoUbicacionesLoading}
          usuariosSinColaborador={usuariosSinColaborador}
          usuariosSinColaboradorError={usuariosSinColaboradorError}
          usuariosSinColaboradorLoading={usuariosSinColaboradorLoading}
          onCancel={() => setShowAccesoCreateModal(false)}
          onChange={handleAccesoCreateChange}
          onLinkUsuarioChange={handleAccesoLinkUsuarioChange}
          onModeChange={handleAccesoModeChange}
          onSubmit={handleAccesoCreate}
        />
      )}

      {/* Editar acceso */}
      {showAccesoEditModal && accesoColaborador && (
        <UsuarioEditModal
          editData={accesoEditData}
          colaboradores={accesoColaboradores}
          colaboradoresError={accesoColaboradoresError}
          colaboradoresLoading={accesoColaboradoresLoading}
          isSaving={isSavingAcceso}
          canManageAssignments={permissions.canManageAssignments}
          lockColaborador
          ubicaciones={accesoUbicaciones}
          ubicacionesError={accesoUbicacionesError}
          ubicacionesLoading={accesoUbicacionesLoading}
          onCancel={() => setShowAccesoEditModal(false)}
          onChange={handleAccesoEditChange}
          onSubmit={handleAccesoEdit}
          onReenviarInvitacion={
            permissions.canEditAcceso && accesoColaborador?.acceso?.pendiente
              ? handleReenviarInvitacionAcceso
              : undefined
          }
          onRevoke={
            permissions.canDeleteAcceso
              ? () =>
                  setRevokeAccesoTarget({
                    usuarioId: accesoUsuarioId,
                    nombreCompleto: accesoColaborador.nombres_completos,
                  })
              : undefined
          }
          selectedUsuario={{ nombre: accesoEditData.nombre, apellido: accesoEditData.apellido }}
        />
      )}

      {/* Invitación con contraseña temporal */}
      {invitationData && (
        <UsuarioInvitationModal
          copied={invitationCopied}
          invitationData={invitationData}
          onClose={closeInvitation}
          onCopy={handleCopyInvitation}
        />
      )}

      {/* Revocar acceso */}
      <ConfirmDialog
        isOpen={!!revokeAccesoTarget}
        title="Revocar acceso"
        message={
          revokeAccesoTarget
            ? `Se revocará el acceso al sistema de "${revokeAccesoTarget.nombreCompleto}". El colaborador se conserva; solo se elimina su usuario.`
            : ''
        }
        confirmText="Revocar acceso"
        processingText="Revocando..."
        cancelText="Cancelar"
        variant="danger"
        isSubmitting={isRevokingAcceso}
        onConfirm={handleRevokeAccesoConfirmed}
        onCancel={() => setRevokeAccesoTarget(null)}
      />

      {/* Export modal */}
      {showExportModal && (
        <PersonalExportModal
          cargos={cargos}
          exportFilters={exportFilters}
          isExporting={isExporting}
          onCancel={() => setShowExportModal(false)}
          onExport={handleExport}
          onFilterChange={setExportFilters}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Eliminar colaborador"
        message={
          confirmTarget
            ? `Eliminarás a "${confirmTarget.nombres_completos}" del cargo "${confirmTarget.cargo || 'Sin cargo'}". Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar colaborador"
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

export default Personal;
