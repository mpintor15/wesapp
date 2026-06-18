import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import personalService from '../../services/personalService';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import ConfirmDialog from '../../components/ConfirmDialog';
import PersonalExportModal from './components/PersonalExportModal';
import PersonalFilters from './components/PersonalFilters';
import PersonalFormModal from './components/PersonalFormModal';
import PersonalMobileCards from './components/PersonalMobileCards';
import PersonalPageHeader from './components/PersonalPageHeader';
import PersonalTable from './components/PersonalTable';
import {
  buildColaboradorPayload,
  buildPersonalExportParams,
  buildPersonalFilterParams,
  EMPTY_COLABORADOR_FORM,
  EMPTY_PERSONAL_EXPORT_FILTERS,
  EMPTY_PERSONAL_FILTERS,
  getColaboradorFormData,
  getNextSortState,
  getTotalPages,
  getUniqueCargos,
  paginateRows,
  sortColaboradores,
  validateColaboradorForm,
} from './utils/personalHelpers';
import './Personal.css';

const Personal = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [colaboradores, setColaboradores] = useState([]);
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
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState(EMPTY_COLABORADOR_FORM);

  const loadColaboradores = useCallback(
    async (params = {}) => {
      setLoading(true);
      const res = await personalService.getColaboradores(params);
      if (res.success) {
        setColaboradores(res.data);
      } else {
        showToast(res.message, 'error');
      }
      setLoading(false);
    },
    [showToast]
  );

  const loadCargos = useCallback(async () => {
    const res = await personalService.getColaboradores();
    if (res.success) {
      setCargos(getUniqueCargos(res.data));
    }
  }, []);

  useEffect(() => {
    loadCargos();
  }, [loadCargos]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadColaboradores(buildPersonalFilterParams(filters));
    }, 300);
    return () => clearTimeout(handler);
  }, [filters, loadColaboradores]);

  const refreshColaboradores = useCallback(() => {
    loadColaboradores(buildPersonalFilterParams(filters));
  }, [filters, loadColaboradores]);

  const [filtersDraft, setFiltersDraft] = useState(EMPTY_PERSONAL_FILTERS);
  const [tableSort, setTableSort] = useState({ field: 'nombres_completos', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

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
    setCurrentPage(1);
  };

  const sortedColaboradores = useMemo(() => {
    return sortColaboradores(colaboradores, tableSort);
  }, [colaboradores, tableSort]);

  const totalPages = getTotalPages(sortedColaboradores);
  const paginatedColaboradores = paginateRows(sortedColaboradores, currentPage);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const resetForm = () => setFormData(EMPTY_COLABORADOR_FORM);

  const openCreate = () => {
    setEditingColaborador(null);
    resetForm();
    setFormErrors({});
    setShowModal(true);
  };

  const openExportModal = () => {
    setExportFilters({
      estado: filters.estado,
      cargo: filters.cargo,
    });
    setShowExportModal(true);
  };

  const openEdit = (colaborador) => {
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
    if (!confirmTarget) return;
    const result = await personalService.deleteColaborador(confirmTarget.id);
    if (result.success) {
      showToast('Colaborador eliminado', 'success');
      refreshColaboradores();
    } else {
      showToast(result.message, 'error');
    }
    setConfirmTarget(null);
  };

  const handleExport = withExportSubmit(async () => {
    const result = await personalService.exportExcel(buildPersonalExportParams(exportFilters));
    if (!result.success) showToast(result.message, 'error');
    setShowExportModal(false);
  });

  return (
    <div className="page-container">
      <PersonalPageHeader
        onBack={() => navigate('/')}
        onCreate={openCreate}
        onExport={openExportModal}
        onRefresh={refreshColaboradores}
      />

      <PersonalFilters
        cargos={cargos}
        filtersDraft={filtersDraft}
        onApply={applyFilters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Table */}
      {loading ? (
        <div className="loading-spinner-wrap">
          <span className="spinner" />
          <span>Cargando colaboradores…</span>
        </div>
      ) : (
        <>
          <div className="table-result-count">
            Mostrando {paginatedColaboradores.length} de {sortedColaboradores.length}{' '}
            colaborador(es)
          </div>

          <PersonalTable
            colaboradores={sortedColaboradores}
            currentPage={currentPage}
            onDelete={setConfirmTarget}
            onEdit={openEdit}
            onPageChange={setCurrentPage}
            onSort={handleTableSort}
            paginatedColaboradores={paginatedColaboradores}
            tableSort={tableSort}
            totalPages={totalPages}
          />
        </>
      )}

      {/* Mobile cards */}
      {!loading && sortedColaboradores.length > 0 && (
        <PersonalMobileCards
          colaboradores={paginatedColaboradores}
          onDelete={setConfirmTarget}
          onEdit={openEdit}
        />
      )}

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
            ? `¿Eliminar a ${confirmTarget.nombres_completos}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

export default Personal;
