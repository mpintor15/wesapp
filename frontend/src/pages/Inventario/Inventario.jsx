import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import InventarioDeleteDialogs from './components/InventarioDeleteDialogs';
import InventarioPageHeader from './components/InventarioPageHeader';
import InventarioReportModals from './components/InventarioReportModals';
import InventarioTabs from './components/InventarioTabs';
import MovimientoModal from './components/MovimientoModal';
import MovimientosTab from './components/MovimientosTab';
import {
  buildArticuloFilterParams,
  buildArticuloPayload,
  buildArticulosExportParams,
  buildBajaPayload,
  buildBajasFilterParams,
  buildMovimientosExportParams,
  buildMovimientoPayload,
  createMovimientoForm,
  EMPTY_ARTICULO_FORM,
  EMPTY_ARTICULOS_EXPORT_FILTERS,
  EMPTY_ARTICULOS_FILTERS,
  EMPTY_BAJAS_EXPORT_FILTERS,
  EMPTY_BAJAS_FILTERS,
  EMPTY_MOVIMIENTOS_EXPORT_FILTERS,
  EMPTY_MOVIMIENTOS_FILTERS,
  addMovimientoItem,
  filterMovimientos,
  filterArticulosForMovimiento,
  getArticuloLabel,
  getArticuloTypeFormData,
  getNextSortState,
  getTotalPages,
  isStockTipo,
  paginateRows,
  removeMovimientoItem,
  sortArticulos,
  sortMovimientos,
  updateIndexedValue,
  updateMovimientoItem,
  validateArticuloForm,
  validateBajaForm,
  validateMovimientoForm,
} from './utils/inventarioHelpers';
import './Inventario.css';

const Inventario = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();

  const [articulos, setArticulos] = useState([]);
  const [catalogArticulos, setCatalogArticulos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [bajas, setBajas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [movimientosLoading, setMovimientosLoading] = useState(false);
  const [bajasLoading, setBajasLoading] = useState(false);
  const [movimientosLoaded, setMovimientosLoaded] = useState(false);
  const [bajasLoaded, setBajasLoaded] = useState(false);
  const { isSubmitting: isSavingArticulo, withSubmit: withArticuloSubmit } = useSubmitState();
  const { isSubmitting: isSavingMovimiento, withSubmit: withMovimientoSubmit } = useSubmitState();
  const { isSubmitting: isSavingBaja, withSubmit: withBajaSubmit } = useSubmitState();
  const { isSubmitting: isExportingArticulos, withSubmit: withArticulosExportSubmit } =
    useSubmitState();
  const { isSubmitting: isExportingBajas, withSubmit: withBajasExportSubmit } = useSubmitState();
  const { isSubmitting: isExportingMovimientos, withSubmit: withMovimientosExportSubmit } =
    useSubmitState();
  const [activeTab, setActiveTab] = useState('articulos');

  // Modals
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMovimientosExportModal, setShowMovimientosExportModal] = useState(false);
  const [showBajasExportModal, setShowBajasExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteCantidad, setDeleteCantidad] = useState(1);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [editingArticulo, setEditingArticulo] = useState(null);
  const [bajaTarget, setBajaTarget] = useState(null);
  const [bajaForm, setBajaForm] = useState({ cantidad: 1, motivo: '' });

  // Forms
  const [movimientoForm, setMovimientoForm] = useState(createMovimientoForm);
  const [itemSearchTerms, setItemSearchTerms] = useState(['']);
  const [itemDropdownOpen, setItemDropdownOpen] = useState([false]);
  const [formData, setFormData] = useState(EMPTY_ARTICULO_FORM);
  const [articuloErrors, setArticuloErrors] = useState({});
  const [movimientoErrors, setMovimientoErrors] = useState({});
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

  const canDeleteArticulo = hasPermission('eliminar_articulo');
  const canDarBajaArticulo = hasPermission('dar_baja_articulo');
  const canEditArticulo = hasPermission('crear_articulo');
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

  // ── Data loading ─────────────────────────────────
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const [ubicacionesRes, articulosRes] = await Promise.all([
      inventarioService.getUbicaciones(),
      inventarioService.getArticulos(),
    ]);

    if (ubicacionesRes.success) setUbicaciones(ubicacionesRes.data);
    if (articulosRes.success) {
      setArticulos(articulosRes.data);
      setCatalogArticulos(articulosRes.data);
    }
    if (!ubicacionesRes.success || !articulosRes.success) {
      showMessage(
        'error',
        ubicacionesRes.message || articulosRes.message || 'Error al cargar inventario'
      );
    }
    setLoading(false);
  }, [showMessage]);

  const fetchArticulos = async (params = {}, refreshCatalog = false) => {
    const shouldFetchCatalog = refreshCatalog && Object.keys(params).length > 0;
    const [res, catalogRes] = await Promise.all([
      inventarioService.getArticulos(params),
      shouldFetchCatalog ? inventarioService.getArticulos() : Promise.resolve(null),
    ]);
    if (res.success) {
      setArticulos(res.data);
      if (refreshCatalog && !shouldFetchCatalog) setCatalogArticulos(res.data);
    } else {
      showMessage('error', res.message);
    }
    if (catalogRes) {
      if (catalogRes.success) {
        setCatalogArticulos(catalogRes.data);
      } else {
        showMessage('error', catalogRes.message);
      }
    }
  };

  const loadMovimientos = useCallback(async () => {
    setMovimientosLoading(true);
    const res = await inventarioService.getMovimientos();
    if (res.success) {
      setMovimientos(res.data);
      setMovimientosLoaded(true);
    } else {
      showMessage('error', res.message);
    }
    setMovimientosLoading(false);
  }, [showMessage]);

  const getActiveBajasFilterParams = useCallback(
    (source = bajasFilters) => buildBajasFilterParams(source),
    [bajasFilters]
  );

  const loadBajas = useCallback(
    async (params = getActiveBajasFilterParams()) => {
      setBajasLoading(true);
      const res = await inventarioService.getBajasArticulos(params);
      if (res.success) {
        setBajas(res.data);
        setBajasLoaded(true);
      } else {
        showMessage('error', res.message);
      }
      setBajasLoading(false);
    },
    [getActiveBajasFilterParams, showMessage]
  );

  useEffect(() => {
    loadInitialData();
    loadMovimientos();
    loadBajas();
  }, [loadInitialData, loadMovimientos, loadBajas]);

  // ── Filters ──────────────────────────────────────
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const getActiveFilterParams = () => buildArticuloFilterParams(filters);

  const handleApplyFilters = async () => {
    setArticulosPage(1);
    setLoading(true);
    await fetchArticulos(getActiveFilterParams());
    setLoading(false);
  };

  const handleClearFilters = async () => {
    setFilters(EMPTY_ARTICULOS_FILTERS);
    setArticulosPage(1);
    setLoading(true);
    await fetchArticulos({}, true);
    setLoading(false);
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
    if (isStockTipo(articulo.tipo_articulo) && articulo.cantidad && articulo.cantidad > 1) {
      setDeleteTarget(articulo);
      setDeleteCantidad(1);
      setShowDeleteModal(true);
      return;
    }
    setDeleteTarget(articulo);
    setShowConfirmDeleteModal(true);
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
      if (bajasLoaded) requests.push(loadBajas());
      await Promise.all(requests);
    } else {
      showMessage('error', result.message);
    }
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await inventarioService.deleteArticulo(deleteTarget.id, deleteCantidad);
    if (result.success) {
      showMessage('success', 'Artículo eliminado');
      await fetchArticulos(getActiveFilterParams(), true);
    } else {
      showMessage('error', result.message);
    }
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handleConfirmSimpleDelete = async () => {
    if (!deleteTarget) return;
    const result = await inventarioService.deleteArticulo(deleteTarget.id, null);
    if (result.success) {
      showMessage('success', 'Artículo eliminado');
      await fetchArticulos(getActiveFilterParams(), true);
    } else {
      showMessage('error', result.message);
    }
    setShowConfirmDeleteModal(false);
    setDeleteTarget(null);
  };

  // ── Movimiento handlers ──────────────────────────
  const openMovimientoModal = () => {
    setMovimientoForm(createMovimientoForm());
    setItemSearchTerms(['']);
    setItemDropdownOpen([false]);
    setMovimientoErrors({});
    setShowMovimientoModal(true);
  };

  const handleMovimientoFormChange = (e) => {
    const { name, value } = e.target;
    setMovimientoForm((prev) => ({ ...prev, [name]: value }));
    setMovimientoErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleMovimientoItemChange = (index, field, value) => {
    setMovimientoForm((prev) => ({
      ...prev,
      items: updateMovimientoItem(prev.items, index, field, value),
    }));
  };

  const handleAddMovimientoItem = () => {
    setMovimientoForm((prev) => ({
      ...prev,
      items: addMovimientoItem(prev.items),
    }));
    setItemSearchTerms((prev) => [...prev, '']);
    setItemDropdownOpen((prev) => [...prev, false]);
  };

  const handleRemoveMovimientoItem = (index) => {
    setMovimientoForm((prev) => ({
      ...prev,
      items: removeMovimientoItem(prev.items, index),
    }));
    setItemSearchTerms((prev) => removeMovimientoItem(prev, index));
    setItemDropdownOpen((prev) => removeMovimientoItem(prev, index));
  };

  const filterArticulos = (searchTerm) =>
    filterArticulosForMovimiento(catalogArticulos, searchTerm);

  const selectArticuloForItem = (index, articulo) => {
    handleMovimientoItemChange(index, 'articulo_id', String(articulo.id));
    handleMovimientoItemChange(index, 'talla', articulo.talla || '');
    handleMovimientoItemChange(index, 'cantidad', 1);
    setItemSearchTerms((prev) => updateIndexedValue(prev, index, getArticuloLabel(articulo)));
    setItemDropdownOpen((prev) => updateIndexedValue(prev, index, false));
  };

  const clearArticuloForItem = (index) => {
    handleMovimientoItemChange(index, 'articulo_id', '');
    handleMovimientoItemChange(index, 'talla', '');
    handleMovimientoItemChange(index, 'cantidad', 1);
    setItemSearchTerms((prev) => updateIndexedValue(prev, index, ''));
  };

  const handleCreateMovimiento = withMovimientoSubmit(async (e) => {
    e.preventDefault();
    const errors = validateMovimientoForm(movimientoForm);

    if (Object.keys(errors).length > 0) {
      setMovimientoErrors(errors);
      showMessage('error', Object.values(errors)[0]);
      return;
    }

    const result = await inventarioService.createMovimiento(buildMovimientoPayload(movimientoForm));
    if (result.success) {
      showMessage('success', 'Movimiento registrado exitosamente');
      setShowMovimientoModal(false);
      await fetchArticulos(getActiveFilterParams(), true);
      await loadMovimientos();
    } else {
      showMessage('error', result.message);
    }
  });

  const handleDownloadPdf = async (movimiento) => {
    const result = await inventarioService.downloadMovimientoPdf(movimiento.id);
    if (!result.success) {
      showMessage('error', result.message);
    }
  };

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
      loadBajas();
    }
  };

  // ── Render ───────────────────────────────────────
  return (
    <div className="inventario-container">
      <InventarioPageHeader
        activeTab={activeTab}
        canCreateArticulo={hasPermission('crear_articulo')}
        canCreateMovimiento={hasPermission('crear_movimiento')}
        canExport={hasPermission('exportar')}
        isExportingBajas={isExportingBajas}
        onBack={() => navigate('/')}
        onCreateArticulo={handleOpenCreate}
        onCreateMovimiento={openMovimientoModal}
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
          onApplyFilters={handleApplyBajasFilters}
          onClearFilters={handleClearBajasFilters}
          onDraftChange={handleBajasDraftChange}
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
          onDownloadPdf={handleDownloadPdf}
          onDraftChange={handleMovimientosDraftChange}
          onPageChange={setMovimientosPage}
          onSort={handleMovimientosSort}
          paginatedMovimientos={paginatedMovimientos}
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

      {showMovimientoModal && (
        <MovimientoModal
          catalogArticulos={catalogArticulos}
          filterArticulos={filterArticulos}
          isSavingMovimiento={isSavingMovimiento}
          itemDropdownOpen={itemDropdownOpen}
          itemSearchTerms={itemSearchTerms}
          movimientoErrors={movimientoErrors}
          movimientoForm={movimientoForm}
          onAddItem={handleAddMovimientoItem}
          onCancel={() => setShowMovimientoModal(false)}
          onClearArticulo={clearArticuloForItem}
          onFormChange={handleMovimientoFormChange}
          onItemChange={handleMovimientoItemChange}
          onRemoveItem={handleRemoveMovimientoItem}
          onSelectArticulo={selectArticuloForItem}
          onSubmit={handleCreateMovimiento}
          setItemDropdownOpen={setItemDropdownOpen}
          setItemSearchTerms={setItemSearchTerms}
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

      <InventarioDeleteDialogs
        deleteCantidad={deleteCantidad}
        deleteTarget={deleteTarget}
        onCancelConfirmDelete={() => setShowConfirmDeleteModal(false)}
        onCancelDeleteCantidad={() => setShowDeleteModal(false)}
        onConfirmDeleteCantidad={handleConfirmDelete}
        onConfirmSimpleDelete={handleConfirmSimpleDelete}
        onDeleteCantidadChange={setDeleteCantidad}
        showConfirmDeleteModal={showConfirmDeleteModal}
        showDeleteModal={showDeleteModal}
      />
    </div>
  );
};

export default Inventario;
