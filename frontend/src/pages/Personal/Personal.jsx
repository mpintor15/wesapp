import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import personalService from '../../services/personalService';
import { getVisibleErrorMessage } from '../../services/serviceUtils';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import ConfirmDialog from '../../components/ConfirmDialog';
import PaginationControls from '../../components/PaginationControls';
import TabularWorkspace from '../../components/TabularWorkspace';
import { can } from '../../auth/authorization';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import PersonalExportModal from './components/PersonalExportModal';
import PersonalFilters from './components/PersonalFilters';
import PersonalFormModal from './components/PersonalFormModal';
import PersonalMobileCards from './components/PersonalMobileCards';
import PersonalPageHeader from './components/PersonalPageHeader';
import PersonalTable from './components/PersonalTable';
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
import './Personal.css';

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
    }),
    [user]
  );

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
    const errors = validateColaboradorForm(formData);

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
          !loading ? (
            <div className="table-result-count">
              Mostrando {sortedColaboradores.length} de {pagination.totalItems} colaborador(es)
            </div>
          ) : null
        }
        pagination={
          !loading ? (
            <PaginationControls
              page={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
            />
          ) : null
        }
      >
        {loading ? (
          <div className="loading-spinner-wrap">
            <span className="spinner" />
            <span>Cargando colaboradores…</span>
          </div>
        ) : (
          <>
            <PersonalTable
              canDelete={permissions.canDelete}
              canEdit={permissions.canEdit}
              colaboradores={sortedColaboradores}
              emptyMessage={emptyMessage}
              onDelete={setConfirmTarget}
              onEdit={openEdit}
              onSort={handleTableSort}
              paginatedColaboradores={sortedColaboradores}
              tableSort={tableSort}
            />
            {sortedColaboradores.length > 0 && (
              <PersonalMobileCards
                canDelete={permissions.canDelete}
                canEdit={permissions.canEdit}
                colaboradores={sortedColaboradores}
                onDelete={setConfirmTarget}
                onEdit={openEdit}
              />
            )}
          </>
        )}
      </TabularWorkspace>

      {/* Create / Edit modal */}
      {showModal && (
        <PersonalFormModal
          editingColaborador={editingColaborador}
          formData={formData}
          formErrors={formErrors}
          isSaving={isSaving}
          onCancel={() => setShowModal(false)}
          onChange={handleFormChange}
          onSubmit={handleSave}
        />
      )}

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
