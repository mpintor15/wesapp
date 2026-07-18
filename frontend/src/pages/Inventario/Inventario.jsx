import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import inventarioService from '../../services/inventarioService';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import ArticuloModal from './components/ArticuloModal';
import ArticulosTab from './components/ArticulosTab';
import BajaArticuloModal from './components/BajaArticuloModal';
import BajasTab from './components/BajasTab';
import InventarioPageHeader from './components/InventarioPageHeader';
import InventarioReportModals from './components/InventarioReportModals';
import InventarioTabs from './components/InventarioTabs';
import InventoryReasonModal from './components/InventoryReasonModal';
import MovimientoModal from './components/MovimientoModal';
import MovimientosTab from './components/MovimientosTab';
import useInventarioData from './hooks/useInventarioData';
import useMovimientoForm from './hooks/useMovimientoForm';
import {
  buildArticuloFilterParams,
  buildArticuloPayload,
  buildArticulosExportParams,
  buildBajaPayload,
  buildBajasFilterParams,
  buildMovimientosExportParams,
  EMPTY_ARTICULO_FORM,
  EMPTY_ARTICULOS_EXPORT_FILTERS,
  EMPTY_ARTICULOS_FILTERS,
  EMPTY_BAJAS_EXPORT_FILTERS,
  EMPTY_BAJAS_FILTERS,
  EMPTY_MOVIMIENTOS_EXPORT_FILTERS,
  EMPTY_MOVIMIENTOS_FILTERS,
  filterMovimientos,
  getArticuloTypeFormData,
  getNextSortState,
  getTotalPages,
  isStockTipo,
  paginateRows,
  sortArticulos,
  sortMovimientos,
  validateArticuloForm,
  validateBajaForm,
  validateMotivoAdministrativo,
} from './utils/inventarioHelpers';
import { getInventoryPermissions, INVENTORY_ACTIONS } from './utils/inventarioPermissions';
import './Inventario.css';

const Inventario = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const inventoryPermissions = useMemo(() => getInventoryPermissions(user), [user]);

  const { isSubmitting: isSavingArticulo, withSubmit: withArticuloSubmit } = useSubmitState();
  const { isSubmitting: isSavingMovimiento, withSubmit: withMovimientoSubmit } = useSubmitState();
  const { isSubmitting: isSavingBaja, withSubmit: withBajaSubmit } = useSubmitState();
  const { isSubmitting: isSubmittingReason, withSubmit: withReasonSubmit } = useSubmitState();
  const { isSubmitting: isExportingArticulos, withSubmit: withArticulosExportSubmit } =
    useSubmitState();
  const { isSubmitting: isExportingBajas, withSubmit: withBajasExportSubmit } = useSubmitState();
  const { isSubmitting: isExportingMovimientos, withSubmit: withMovimientosExportSubmit } =
    useSubmitState();
  const [activeTab, setActiveTab] = useState('articulos');

  // Modals
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMovimientosExportModal, setShowMovimientosExportModal] = useState(false);
  const [showBajasExportModal, setShowBajasExportModal] = useState(false);
  const [reasonAction, setReasonAction] = useState(null);
  const [reasonMotivo, setReasonMotivo] = useState('');
  const [regeneratingPdfId, setRegeneratingPdfId] = useState(null);
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [editingArticulo, setEditingArticulo] = useState(null);
  const [bajaTarget, setBajaTarget] = useState(null);
  const [bajaForm, setBajaForm] = useState({ cantidad: 1, motivo: '' });

  // Forms
  const [formData, setFormData] = useState(EMPTY_ARTICULO_FORM);
  const [articuloErrors, setArticuloErrors] = useState({});
  const [filters, setFilters] = useState(EMPTY_ARTICULOS_FILTERS);
  const [movimientosFilters, setMovimientosFilters] = useState(EMPTY_MOVIMIENTOS_FILTERS);
  const [movimientosFiltersDraft, setMovimientosFiltersDraft] = useState(EMPTY_MOVIMIENTOS_FILTERS);
  const [bajasFilters, setBajasFilters] = useState(EMPTY_BAJAS_FILTERS);
  const [bajasFiltersDraft, setBajasFiltersDraft] = useState(EMPTY_BAJAS_FILTERS);
  const [exportFilters, setExportFilters] = useState(EMPTY_ARTICULOS_EXPORT_FILTERS);
  const [movimientosExportFilters, setMovimientosExportFilters] = useState(
    EMPTY_MOVIMIENTOS_EXPORT_FILTERS
  );
  const [bajasExportFilters, setBajasExportFilters] = useState(EMPTY_BAJAS_EXPORT_FILTERS);
  const [articulosSort, setArticulosSort] = useState({ field: 'tipo_articulo', direction: 'asc' });
  const [articulosPage, setArticulosPage] = useState(1);
  const [movimientosPage, setMovimientosPage] = useState(1);
  const [movimientosSort, setMovimientosSort] = useState({
    field: 'fecha_movimiento',
    direction: 'desc',
  });

  const showMessage = useCallback(
    (type, text) => {
      showToast(text, type);
    },
    [showToast]
  );

  const {
    articulos,
    catalogArticulos,
    ubicaciones,
    movimientos,
    bajas,
    loading,
    movimientosLoading,
    bajasLoading,
    movimientosLoaded,
    bajasLoaded,
    fetchArticulos,
    loadMovimientos,
    loadBajas,
  } = useInventarioData({ showMessage });

  const canCreateArticulo = inventoryPermissions.can(INVENTORY_ACTIONS.ARTICULOS_CREATE);
  const canCreateMovimiento = inventoryPermissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_CREATE);
  const canExport = inventoryPermissions.can(INVENTORY_ACTIONS.REPORTS_EXPORT);
  const canDeleteArticulo = inventoryPermissions.can(INVENTORY_ACTIONS.ARTICULOS_DELETE_ADMIN);
  const canDarBajaArticulo = inventoryPermissions.can(INVENTORY_ACTIONS.ARTICULOS_BAJA);
  const canEditArticulo = inventoryPermissions.can(INVENTORY_ACTIONS.ARTICULOS_EDIT);
  const showArticuloActions = canEditArticulo || canDeleteArticulo || canDarBajaArticulo;
  const articuloActionCount = [canEditArticulo, canDarBajaArticulo, canDeleteArticulo].filter(
    Boolean
  ).length;
  const articuloActionsClass =
    articuloActionCount >= 3
      ? 'app-col-actions--triple'
      : articuloActionCount === 2
        ? 'app-col-actions--double'
        : 'app-col-actions--single';

  const getActiveBajasFilterParams = useCallback(
    (source = bajasFilters) => buildBajasFilterParams(source),
    [bajasFilters]
  );

  const getActiveFilterParams = useCallback(() => buildArticuloFilterParams(filters), [filters]);

  const handleMovimientoCreated = useCallback(async () => {
    await fetchArticulos(getActiveFilterParams(), true);
    await loadMovimientos();
  }, [fetchArticulos, getActiveFilterParams, loadMovimientos]);

  const movimientoFormState = useMovimientoForm({
    catalogArticulos,
    canRegeneratePdf: inventoryPermissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_REGENERATE),
    showMessage,
    onCreated: handleMovimientoCreated,
  });

  // ── Filters ──────────────────────────────────────
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = async () => {
    setArticulosPage(1);
    await fetchArticulos(getActiveFilterParams(), false, { showLoading: true });
  };

  const handleClearFilters = async () => {
    setFilters(EMPTY_ARTICULOS_FILTERS);
    setArticulosPage(1);
    await fetchArticulos({}, true, { showLoading: true });
  };

  const handleMovimientosDraftChange = (e) => {
    const { name, value } = e.target;
    setMovimientosFiltersDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyMovimientosFilters = () => {
    setMovimientosFilters({ ...movimientosFiltersDraft });
    setMovimientosPage(1);
  };

  const handleClearMovimientosFilters = () => {
    setMovimientosFiltersDraft(EMPTY_MOVIMIENTOS_FILTERS);
    setMovimientosFilters(EMPTY_MOVIMIENTOS_FILTERS);
    setMovimientosPage(1);
  };

  const handleBajasDraftChange = (e) => {
    const { name, value } = e.target;
    setBajasFiltersDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyBajasFilters = async () => {
    const nextFilters = { ...bajasFiltersDraft };
    setBajasFilters(nextFilters);
    await loadBajas(getActiveBajasFilterParams(nextFilters));
  };

  const handleClearBajasFilters = async () => {
    setBajasFiltersDraft(EMPTY_BAJAS_FILTERS);
    setBajasFilters(EMPTY_BAJAS_FILTERS);
    await loadBajas({});
  };

  // ── Artículo CRUD ────────────────────────────────
  const resetFormData = (overrides = {}) => {
    setFormData({
      ...EMPTY_ARTICULO_FORM,
      ...overrides,
    });
  };

  const handleOpenCreate = () => {
    setEditingArticulo(null);
    resetFormData();
    setArticuloErrors({});
    setShowArticuloModal(true);
  };

  const handleOpenEdit = (articulo) => {
    setEditingArticulo(articulo);
    setFormData({
      ...EMPTY_ARTICULO_FORM,
      tipo_articulo: articulo.tipo_articulo || '',
      nombre_articulo: articulo.nombre_articulo || '',
      cantidad: articulo.cantidad ? String(articulo.cantidad) : '',
      talla: articulo.talla || '',
      marca: articulo.marca || '',
      modelo: articulo.modelo || '',
      numero_serie: articulo.numero_serie || '',
      calibre: articulo.calibre || '',
      fecha_caducidad: articulo.fecha_caducidad ? articulo.fecha_caducidad.slice(0, 10) : '',
      ubicacion_nombre: articulo.ubicacion_nombre || '',
      codigo_pantalla: articulo.codigo_pantalla || '',
      codigo_radio: articulo.codigo_radio || '',
      version: articulo.version || '',
    });
    setArticuloErrors({});
    setShowArticuloModal(true);
  };

  const handleCancelArticulo = () => {
    setShowArticuloModal(false);
    setEditingArticulo(null);
  };

  const handleTipoChange = (e) => {
    const nextTipo = e.target.value;
    setArticuloErrors((prev) => ({ ...prev, tipo_articulo: '', cantidad: '' }));
    setFormData((prev) => getArticuloTypeFormData(prev, nextTipo));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setArticuloErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSaveArticulo = withArticuloSubmit(async (e) => {
    e.preventDefault();
    const errors = validateArticuloForm(formData);

    if (Object.keys(errors).length > 0) {
      setArticuloErrors(errors);
      showMessage('error', Object.values(errors)[0]);
      return;
    }

    const payload = buildArticuloPayload(formData);
    const result = editingArticulo
      ? await inventarioService.updateArticulo(editingArticulo.id, payload)
      : await inventarioService.createArticulo(payload);

    if (result.success) {
      showMessage(
        'success',
        editingArticulo ? 'Artículo actualizado exitosamente' : 'Artículo creado exitosamente'
      );
      setShowArticuloModal(false);
      setEditingArticulo(null);
      await fetchArticulos(getActiveFilterParams(), true);
    } else {
      showMessage('error', result.message);
    }
  });

  const handleDeleteArticulo = (articulo) => {
    setReasonAction({
      type: 'deleteArticulo',
      title: 'Eliminar administrativamente',
      confirmText: 'Eliminar administrativamente',
      entityLabel: 'Artículo',
      entityName:
        articulo.nombre_articulo || articulo.numero_serie || articulo.codigo_radio || articulo.id,
      target: articulo,
      messages: [
        'El artículo dejará de aparecer en listados operativos cuando el backend lo excluya.',
        'El historial se conservará.',
        'Esta acción no retira una cantidad parcial; para retirar unidades usa una baja o movimiento.',
        'Se requiere un motivo administrativo.',
      ],
      placeholder: 'Describe el motivo administrativo de la eliminación',
    });
    setReasonMotivo('');
  };

  const handleOpenBaja = (articulo) => {
    setBajaTarget(articulo);
    setBajaForm({
      cantidad: isStockTipo(articulo.tipo_articulo) ? 1 : 1,
      motivo: '',
    });
    setShowBajaModal(true);
  };

  const handleConfirmBaja = withBajaSubmit(async () => {
    if (!bajaTarget) return;
    const bajaError = validateBajaForm(bajaTarget, bajaForm);

    if (bajaError) {
      showMessage('error', bajaError.message);
      return;
    }

    const result = await inventarioService.darBajaArticulo(
      bajaTarget.id,
      buildBajaPayload(bajaTarget, bajaForm)
    );
    if (result.success) {
      showMessage('success', result.message || 'Artículo dado de baja');
      setShowBajaModal(false);
      setBajaTarget(null);
      const requests = [fetchArticulos(getActiveFilterParams(), true)];
      if (bajasLoaded) requests.push(loadBajas(getActiveBajasFilterParams()));
      await Promise.all(requests);
    } else {
      showMessage('error', result.message);
    }
  });

  const handleDownloadPdf = async (movimiento) => {
    const result = await inventarioService.downloadMovimientoPdf(movimiento.id);
    if (!result.success) {
      showMessage('error', result.message);
    } else if (result.cancelled) {
      showMessage('info', 'Descarga cancelada');
    }
  };

  const handleRegeneratePdf = async (movimiento) => {
    setRegeneratingPdfId(movimiento.id);
    const result = await inventarioService.regenerateMovimientoPdf(movimiento.id);
    setRegeneratingPdfId(null);

    if (result.success) {
      showMessage('success', result.message || 'PDF regenerado correctamente');
      await loadMovimientos();
      return;
    }

    showMessage(
      'error',
      result.status === 403
        ? 'No tienes permisos suficientes para regenerar el PDF.'
        : result.message
    );
  };

  const openReasonAction = (action) => {
    setReasonAction(action);
    setReasonMotivo('');
  };

  const closeReasonModal = () => {
    if (isSubmittingReason) return;
    setReasonAction(null);
    setReasonMotivo('');
  };

  const handleVoidMovimiento = (movimiento) => {
    openReasonAction({
      type: 'voidMovimiento',
      title: 'Anular movimiento',
      confirmText: 'Anular movimiento',
      entityLabel: 'Movimiento',
      entityName: movimiento.articulos_movidos || `Movimiento ${movimiento.id}`,
      target: movimiento,
      messages: [
        'La anulación intentará revertir el stock asociado a este movimiento.',
        'El movimiento permanecerá visible como anulado.',
        'Se requiere un motivo entre 10 y 500 caracteres.',
      ],
      placeholder: 'Describe el motivo de la anulación',
    });
  };

  const handleDeleteMovimiento = (movimiento) => {
    openReasonAction({
      type: 'deleteMovimiento',
      title: 'Eliminar movimiento administrativamente',
      confirmText: 'Eliminar administrativamente',
      entityLabel: 'Movimiento',
      entityName: movimiento.articulos_movidos || `Movimiento ${movimiento.id}`,
      target: movimiento,
      messages: [
        'Esta eliminación es administrativa y conserva el historial.',
        'El movimiento debe estar anulado antes de eliminarse administrativamente.',
        'Se requiere un motivo entre 10 y 500 caracteres.',
      ],
      placeholder: 'Describe el motivo administrativo',
    });
  };

  const handleVoidBaja = (baja) => {
    openReasonAction({
      type: 'voidBaja',
      title: 'Anular baja',
      confirmText: 'Anular baja',
      entityLabel: 'Baja',
      entityName: baja.nombre_articulo || baja.numero_serie || baja.id,
      target: baja,
      messages: [
        'La anulación intentará restaurar el stock asociado a esta baja.',
        'La baja permanecerá visible como anulada.',
        'Se requiere un motivo entre 10 y 500 caracteres.',
      ],
      placeholder: 'Describe el motivo de la anulación',
    });
  };

  const handleDeleteBaja = (baja) => {
    openReasonAction({
      type: 'deleteBaja',
      title: 'Eliminar baja administrativamente',
      confirmText: 'Eliminar administrativamente',
      entityLabel: 'Baja',
      entityName: baja.nombre_articulo || baja.numero_serie || baja.id,
      target: baja,
      messages: [
        'Esta eliminación es administrativa y conserva el historial.',
        'La baja debe estar anulada antes de eliminarse administrativamente.',
        'Se requiere un motivo entre 10 y 500 caracteres.',
      ],
      placeholder: 'Describe el motivo administrativo',
    });
  };

  const handleConfirmReasonAction = withReasonSubmit(async () => {
    if (!reasonAction) return;
    const validationError = validateMotivoAdministrativo(reasonMotivo);
    if (validationError) {
      showMessage('error', validationError);
      return;
    }

    const motivo = reasonMotivo.trim();
    const targetId = reasonAction.target.id;
    const operations = {
      deleteArticulo: () => inventarioService.deleteArticulo(targetId, motivo),
      voidMovimiento: () => inventarioService.anularMovimiento(targetId, motivo),
      deleteMovimiento: () => inventarioService.eliminarMovimiento(targetId, motivo),
      voidBaja: () => inventarioService.anularBaja(targetId, motivo),
      deleteBaja: () => inventarioService.eliminarBaja(targetId, motivo),
    };

    const result = await operations[reasonAction.type]?.();
    if (!result) return;

    if (!result.success) {
      showMessage(
        'error',
        result.status === 403 ? 'No tienes permisos suficientes para esta acción.' : result.message
      );
      return;
    }

    showMessage('success', result.message || 'Acción completada');
    setReasonAction(null);
    setReasonMotivo('');

    if (reasonAction.type === 'deleteArticulo') {
      await fetchArticulos(getActiveFilterParams(), true);
      return;
    }

    if (reasonAction.type === 'voidMovimiento') {
      await Promise.all([loadMovimientos(), fetchArticulos(getActiveFilterParams(), true)]);
      return;
    }

    if (reasonAction.type === 'deleteMovimiento') {
      await loadMovimientos();
      return;
    }

    if (reasonAction.type === 'voidBaja') {
      await Promise.all([
        loadBajas(getActiveBajasFilterParams()),
        fetchArticulos(getActiveFilterParams(), true),
      ]);
      return;
    }

    if (reasonAction.type === 'deleteBaja') {
      await loadBajas(getActiveBajasFilterParams());
    }
  });

  const openExportModal = () => {
    setExportFilters({
      tipo: filters.tipo,
      ubicacion_id: filters.ubicacion_id,
      estado: filters.estado,
    });
    setShowExportModal(true);
  };

  const openMovimientosExportModal = () => {
    setMovimientosExportFilters({
      destino_id: movimientosFilters.destino_id,
      from: movimientosFilters.from,
      to: movimientosFilters.to,
    });
    setShowMovimientosExportModal(true);
  };

  const openBajasExportModal = () => {
    setBajasExportFilters({
      from: bajasFilters.from,
      to: bajasFilters.to,
    });
    setShowBajasExportModal(true);
  };

  const handleExport = withArticulosExportSubmit(async () => {
    const result = await inventarioService.exportArticulosExcel(
      buildArticulosExportParams(exportFilters)
    );
    if (!result.success) {
      showMessage('error', result.message);
    }
    setShowExportModal(false);
  });

  const handleMovimientosExport = withMovimientosExportSubmit(async () => {
    const result = await inventarioService.exportMovimientosExcel(
      buildMovimientosExportParams(movimientosExportFilters)
    );
    if (!result.success) {
      showMessage('error', result.message);
      return;
    }
    setShowMovimientosExportModal(false);
  });

  const handleBajasExport = withBajasExportSubmit(async () => {
    const result = await inventarioService.exportBajasArticulosExcel(bajasExportFilters);
    if (!result.success) {
      showMessage('error', result.message);
      return;
    }
    setShowBajasExportModal(false);
  });

  // ── Helpers ──────────────────────────────────────
  const emptyStateText = useMemo(() => {
    if (filters.tipo || filters.ubicacion_id || filters.estado || filters.search) {
      return 'No hay artículos que coincidan con los filtros.';
    }
    return 'No hay artículos registrados en inventario.';
  }, [filters]);

  const sortedArticulos = useMemo(
    () => sortArticulos(articulos, articulosSort),
    [articulos, articulosSort]
  );

  const articulosTotalPages = getTotalPages(sortedArticulos);
  const paginatedArticulos = paginateRows(sortedArticulos, articulosPage);

  const handleArticulosSort = (field) => {
    setArticulosSort((prev) => getNextSortState(prev, field));
    setArticulosPage(1);
  };

  const filteredMovimientos = useMemo(
    () => filterMovimientos(movimientos, movimientosFilters),
    [movimientos, movimientosFilters]
  );

  const sortedMovimientos = useMemo(
    () => sortMovimientos(filteredMovimientos, movimientosSort),
    [filteredMovimientos, movimientosSort]
  );

  const movimientosTotalPages = getTotalPages(sortedMovimientos);
  const paginatedMovimientos = paginateRows(sortedMovimientos, movimientosPage);
  const handleMovimientosSort = (field) => {
    setMovimientosSort((prev) => getNextSortState(prev, field));
    setMovimientosPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'movimientos' && !movimientosLoaded && !movimientosLoading) {
      loadMovimientos();
    }
    if (tab === 'bajas' && !bajasLoaded && !bajasLoading) {
      loadBajas(getActiveBajasFilterParams());
    }
  };

  // ── Render ───────────────────────────────────────
  if (!inventoryPermissions.canAccessInventory) {
    return (
      <div className="inventario-container">
        <div className="empty-state">No tienes acceso al módulo de Inventario.</div>
      </div>
    );
  }

  return (
    <div className="inventario-container">
      <InventarioPageHeader
        activeTab={activeTab}
        canCreateArticulo={canCreateArticulo}
        canCreateMovimiento={canCreateMovimiento}
        canExport={canExport}
        isExportingBajas={isExportingBajas}
        onBack={() => navigate('/')}
        onCreateArticulo={handleOpenCreate}
        onCreateMovimiento={movimientoFormState.open}
        onExportArticulos={openExportModal}
        onExportBajas={openBajasExportModal}
        onExportMovimientos={openMovimientosExportModal}
        onRefresh={() => {
          if (activeTab === 'articulos') return fetchArticulos(getActiveFilterParams(), true);
          if (activeTab === 'movimientos') return loadMovimientos();
          return loadBajas(getActiveBajasFilterParams());
        }}
      />

      <InventarioTabs
        activeTab={activeTab}
        articulosCount={articulos.length}
        bajasCount={bajas.length}
        movimientosCount={movimientos.length}
        onTabChange={handleTabChange}
      />

      {activeTab === 'articulos' && (
        <ArticulosTab
          articuloActionsClass={articuloActionsClass}
          articulosPage={articulosPage}
          articulosSort={articulosSort}
          articulosTotalPages={articulosTotalPages}
          canDarBajaArticulo={canDarBajaArticulo}
          canDeleteArticulo={canDeleteArticulo}
          canEditArticulo={canEditArticulo}
          emptyStateText={emptyStateText}
          filters={filters}
          loading={loading}
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          onDarBaja={handleOpenBaja}
          onDelete={handleDeleteArticulo}
          onEdit={handleOpenEdit}
          onFilterChange={handleFilterChange}
          onPageChange={setArticulosPage}
          onSort={handleArticulosSort}
          paginatedArticulos={paginatedArticulos}
          showArticuloActions={showArticuloActions}
          sortedArticulos={sortedArticulos}
          ubicaciones={ubicaciones}
        />
      )}

      {activeTab === 'bajas' && (
        <BajasTab
          bajas={bajas}
          bajasFiltersDraft={bajasFiltersDraft}
          bajasLoading={bajasLoading}
          onDeleteBaja={handleDeleteBaja}
          onApplyFilters={handleApplyBajasFilters}
          onClearFilters={handleClearBajasFilters}
          onDraftChange={handleBajasDraftChange}
          onVoidBaja={handleVoidBaja}
          permissions={inventoryPermissions}
        />
      )}

      {activeTab === 'movimientos' && (
        <MovimientosTab
          movimientosFiltersDraft={movimientosFiltersDraft}
          movimientosLoading={movimientosLoading}
          movimientosPage={movimientosPage}
          movimientosSort={movimientosSort}
          movimientosTotalPages={movimientosTotalPages}
          onApplyFilters={handleApplyMovimientosFilters}
          onClearFilters={handleClearMovimientosFilters}
          onDeleteMovimiento={handleDeleteMovimiento}
          onDownloadPdf={handleDownloadPdf}
          onDraftChange={handleMovimientosDraftChange}
          onPageChange={setMovimientosPage}
          onRegeneratePdf={handleRegeneratePdf}
          onSort={handleMovimientosSort}
          onVoidMovimiento={handleVoidMovimiento}
          paginatedMovimientos={paginatedMovimientos}
          permissions={inventoryPermissions}
          regeneratingPdfId={regeneratingPdfId}
          sortedMovimientos={sortedMovimientos}
          ubicaciones={ubicaciones}
        />
      )}

      {showArticuloModal && (
        <ArticuloModal
          articuloErrors={articuloErrors}
          formData={formData}
          isEditing={Boolean(editingArticulo)}
          isSavingArticulo={isSavingArticulo}
          onCancel={handleCancelArticulo}
          onFormChange={handleFormChange}
          onSubmit={handleSaveArticulo}
          onTipoChange={handleTipoChange}
        />
      )}

      {movimientoFormState.isOpen && (
        <MovimientoModal
          catalogArticulos={catalogArticulos}
          filterArticulos={movimientoFormState.filterArticulos}
          isSavingMovimiento={isSavingMovimiento}
          itemDropdownOpen={movimientoFormState.itemDropdownOpen}
          itemSearchTerms={movimientoFormState.itemSearchTerms}
          movimientoErrors={movimientoFormState.movimientoErrors}
          movimientoForm={movimientoFormState.movimientoForm}
          onAddItem={movimientoFormState.handleAddMovimientoItem}
          onCancel={movimientoFormState.close}
          onClearArticulo={movimientoFormState.clearArticuloForItem}
          onFormChange={movimientoFormState.handleMovimientoFormChange}
          onItemChange={movimientoFormState.handleMovimientoItemChange}
          onRemoveItem={movimientoFormState.handleRemoveMovimientoItem}
          onSelectArticulo={movimientoFormState.selectArticuloForItem}
          onSubmit={withMovimientoSubmit(movimientoFormState.handleCreateMovimiento)}
          setItemDropdownOpen={movimientoFormState.setItemDropdownOpen}
          setItemSearchTerms={movimientoFormState.setItemSearchTerms}
        />
      )}

      <InventarioReportModals
        bajasExportFilters={bajasExportFilters}
        exportFilters={exportFilters}
        isExportingArticulos={isExportingArticulos}
        isExportingBajas={isExportingBajas}
        isExportingMovimientos={isExportingMovimientos}
        movimientosExportFilters={movimientosExportFilters}
        onArticulosExport={handleExport}
        onArticulosFilterChange={setExportFilters}
        onBajasExport={handleBajasExport}
        onBajasFilterChange={setBajasExportFilters}
        onCancelArticulos={() => setShowExportModal(false)}
        onCancelBajas={() => setShowBajasExportModal(false)}
        onCancelMovimientos={() => setShowMovimientosExportModal(false)}
        onMovimientosExport={handleMovimientosExport}
        onMovimientosFilterChange={setMovimientosExportFilters}
        showBajasExportModal={showBajasExportModal}
        showExportModal={showExportModal}
        showMovimientosExportModal={showMovimientosExportModal}
        ubicaciones={ubicaciones}
      />

      {showBajaModal && bajaTarget && (
        <BajaArticuloModal
          bajaForm={bajaForm}
          bajaTarget={bajaTarget}
          isSavingBaja={isSavingBaja}
          onCancel={() => setShowBajaModal(false)}
          onConfirm={handleConfirmBaja}
          onFormChange={setBajaForm}
        />
      )}

      <InventoryReasonModal
        action={reasonAction}
        isSubmitting={isSubmittingReason}
        motivo={reasonMotivo}
        onCancel={closeReasonModal}
        onConfirm={handleConfirmReasonAction}
        onMotivoChange={setReasonMotivo}
      />
    </div>
  );
};

export default Inventario;
