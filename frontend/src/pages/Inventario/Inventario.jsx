import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import inventarioService from '../../services/inventarioService';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import './Inventario.css';

const ROWS_PER_PAGE = 50;

const INVENTARIO_TIPOS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'equipo', label: 'Equipo' },
  { value: 'placa_balistica', label: 'Placa Balística' },
  { value: 'arma', label: 'Arma' },
  { value: 'radio', label: 'Radio' },
  { value: 'otro', label: 'Otro' }
];

const ARTICULO_TIPOS = INVENTARIO_TIPOS.filter(tipo => tipo.value);
const isStockTipo = (tipo) => tipo === 'equipo' || tipo === 'otro';

const INVENTARIO_ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'sin_alerta', label: 'Sin alerta' },
  { value: 'vigente', label: 'Vigente' },
  { value: 'proxima_a_vencer', label: 'Próxima a vencer' },
  { value: 'vencida', label: 'Vencida' }
];

const getTodayLocalISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (dateStr) => {
  const parsed = parseDateSafe(dateStr);
  if (!parsed) return '-';
  return parsed.toLocaleDateString('es-EC');
};

const Inventario = () => {
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
  const { isSubmitting: isSavingArticulo, withSubmit: withArticuloSubmit } = useSubmitState();
  const { isSubmitting: isSavingMovimiento, withSubmit: withMovimientoSubmit } = useSubmitState();
  const { isSubmitting: isSavingBaja, withSubmit: withBajaSubmit } = useSubmitState();
  const { isSubmitting: isExportingArticulos, withSubmit: withArticulosExportSubmit } = useSubmitState();
  const { isSubmitting: isExportingBajas, withSubmit: withBajasExportSubmit } = useSubmitState();
  const { isSubmitting: isExportingMovimientos, withSubmit: withMovimientosExportSubmit } = useSubmitState();
  const [activeTab, setActiveTab] = useState('articulos');

  // Modals
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMovimientosExportModal, setShowMovimientosExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteCantidad, setDeleteCantidad] = useState(1);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [bajaTarget, setBajaTarget] = useState(null);
  const [bajaForm, setBajaForm] = useState({ cantidad: 1, motivo: '' });

  // Forms
  const [movimientoForm, setMovimientoForm] = useState({
    tipo_movimiento: 'traslado',
    fecha_movimiento: getTodayLocalISO(),
    ubicacion_destino_nombre: '',
    items: [{ articulo_id: '', cantidad: 1, talla: '' }]
  });
  const [itemSearchTerms, setItemSearchTerms] = useState(['']);
  const [itemDropdownOpen, setItemDropdownOpen] = useState([false]);
  const [formData, setFormData] = useState({
    tipo_articulo: '',
    nombre_articulo: '',
    cantidad: '',
    talla: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    calibre: '',
    fecha_caducidad: '',
    ubicacion_nombre: '',
    codigo_pantalla: '',
    codigo_radio: '',
    version: ''
  });
  const [articuloErrors, setArticuloErrors] = useState({});
  const [movimientoErrors, setMovimientoErrors] = useState({});
  const [filters, setFilters] = useState({
    tipo: '',
    ubicacion_id: '',
    estado: '',
    search: ''
  });
  const [movimientosFilters, setMovimientosFilters] = useState({
    search: '',
    destino_id: '',
    from: '',
    to: ''
  });
  const [movimientosFiltersDraft, setMovimientosFiltersDraft] = useState({
    search: '',
    destino_id: '',
    from: '',
    to: ''
  });
  const [bajasFilters, setBajasFilters] = useState({
    search: '',
    from: '',
    to: ''
  });
  const [bajasFiltersDraft, setBajasFiltersDraft] = useState({
    search: '',
    from: '',
    to: ''
  });
  const [exportFilters, setExportFilters] = useState({
    tipo: '',
    ubicacion_id: '',
    estado: ''
  });
  const [movimientosExportFilters, setMovimientosExportFilters] = useState({
    destino_id: '',
    from: '',
    to: ''
  });
  const [articulosSort, setArticulosSort] = useState({ field: 'tipo_articulo', direction: 'asc' });
  const [articulosPage, setArticulosPage] = useState(1);
  const [movimientosPage, setMovimientosPage] = useState(1);
  const [movimientosSort, setMovimientosSort] = useState({ field: 'fecha_movimiento', direction: 'desc' });

  const showMessage = useCallback((type, text) => {
    showToast(text, type);
  }, [showToast]);

  const canDeleteArticulo = hasPermission('eliminar_articulo');
  const canDarBajaArticulo = hasPermission('dar_baja_articulo');
  const showArticuloActions = canDeleteArticulo || canDarBajaArticulo;
  const articuloActionsClass = canDeleteArticulo && canDarBajaArticulo
    ? 'app-col-actions--double'
    : 'app-col-actions--single';

  // ── Data loading ─────────────────────────────────
  useEffect(() => {
    loadInitialData();
    loadMovimientos();
    loadBajas();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const [ubicacionesRes, articulosRes] = await Promise.all([
      inventarioService.getUbicaciones(),
      inventarioService.getArticulos()
    ]);

    if (ubicacionesRes.success) setUbicaciones(ubicacionesRes.data);
    if (articulosRes.success) {
      setArticulos(articulosRes.data);
      setCatalogArticulos(articulosRes.data);
    }
    if (!ubicacionesRes.success || !articulosRes.success) {
      showMessage('error', ubicacionesRes.message || articulosRes.message || 'Error al cargar inventario');
    }
    setLoading(false);
  };

  const fetchArticulos = async (params = {}, updateCatalog = false) => {
    const res = await inventarioService.getArticulos(params);
    if (res.success) {
      setArticulos(res.data);
      if (updateCatalog) setCatalogArticulos(res.data);
    } else {
      showMessage('error', res.message);
    }
  };

  const loadMovimientos = async () => {
    setMovimientosLoading(true);
    const res = await inventarioService.getMovimientos();
    if (res.success) {
      setMovimientos(res.data);
    } else {
      showMessage('error', res.message);
    }
    setMovimientosLoading(false);
  };

  const getActiveBajasFilterParams = (source = bajasFilters) => {
    const params = {};
    if (source.search) params.search = source.search;
    if (source.from) params.from = source.from;
    if (source.to) params.to = source.to;
    return params;
  };

  const loadBajas = async (params = getActiveBajasFilterParams()) => {
    setBajasLoading(true);
    const res = await inventarioService.getBajasArticulos(params);
    if (res.success) {
      setBajas(res.data);
    } else {
      showMessage('error', res.message);
    }
    setBajasLoading(false);
  };

  // ── Filters ──────────────────────────────────────
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getActiveFilterParams = () => {
    const params = {};
    if (filters.tipo) params.tipo = filters.tipo;
    if (filters.ubicacion_id) params.ubicacion_id = filters.ubicacion_id;
    if (filters.estado) params.estado = filters.estado;
    if (filters.search) params.search = filters.search;
    return params;
  };

  const handleApplyFilters = async () => {
    setArticulosPage(1);
    setLoading(true);
    await fetchArticulos(getActiveFilterParams());
    setLoading(false);
  };

  const handleClearFilters = async () => {
    setFilters({ tipo: '', ubicacion_id: '', estado: '', search: '' });
    setArticulosPage(1);
    setLoading(true);
    await fetchArticulos({}, true);
    setLoading(false);
  };

  const handleMovimientosDraftChange = (e) => {
    const { name, value } = e.target;
    setMovimientosFiltersDraft(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyMovimientosFilters = () => {
    setMovimientosFilters({ ...movimientosFiltersDraft });
    setMovimientosPage(1);
  };

  const handleClearMovimientosFilters = () => {
    const cleared = { search: '', destino_id: '', from: '', to: '' };
    setMovimientosFiltersDraft(cleared);
    setMovimientosFilters(cleared);
    setMovimientosPage(1);
  };

  const handleBajasDraftChange = (e) => {
    const { name, value } = e.target;
    setBajasFiltersDraft(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyBajasFilters = async () => {
    const nextFilters = { ...bajasFiltersDraft };
    setBajasFilters(nextFilters);
    await loadBajas(getActiveBajasFilterParams(nextFilters));
  };

  const handleClearBajasFilters = async () => {
    const cleared = { search: '', from: '', to: '' };
    setBajasFiltersDraft(cleared);
    setBajasFilters(cleared);
    await loadBajas({});
  };

  // ── Artículo CRUD ────────────────────────────────
  const resetFormData = (overrides = {}) => {
    setFormData({
      tipo_articulo: '', nombre_articulo: '', cantidad: '', talla: '',
      marca: '', modelo: '', numero_serie: '', calibre: '',
      fecha_caducidad: '', ubicacion_nombre: '',
      codigo_pantalla: '', codigo_radio: '', version: '', ...overrides
    });
  };

  const handleOpenCreate = () => {
    resetFormData();
    setArticuloErrors({});
    setShowArticuloModal(true);
  };

  const handleTipoChange = (e) => {
    const nextTipo = e.target.value;
    setArticuloErrors(prev => ({ ...prev, tipo_articulo: '', cantidad: '' }));
    setFormData(prev => {
      const base = { ...prev, tipo_articulo: nextTipo };
      if (nextTipo === 'equipo' || nextTipo === 'otro') {
        return { ...base, nombre_articulo: '', marca: '', modelo: '', numero_serie: '', calibre: '', fecha_caducidad: '', codigo_pantalla: '', codigo_radio: '', version: '' };
      }
      if (nextTipo === 'placa_balistica') {
        return { ...base, nombre_articulo: 'Placa Balística', cantidad: '', talla: '', marca: '', modelo: '', calibre: '', codigo_pantalla: '', codigo_radio: '', version: '' };
      }
      if (nextTipo === 'arma') {
        return { ...base, nombre_articulo: '', cantidad: '', talla: '', fecha_caducidad: '', codigo_pantalla: '', codigo_radio: '', version: '' };
      }
      if (nextTipo === 'radio') {
        return { ...base, nombre_articulo: 'Radio', cantidad: '', talla: '', numero_serie: '', calibre: '', fecha_caducidad: '' };
      }
      return base;
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setArticuloErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSaveArticulo = withArticuloSubmit(async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.tipo_articulo) errors.tipo_articulo = 'Selecciona un tipo de artículo';
    if (!formData.nombre_articulo.trim()) errors.nombre_articulo = 'Ingresa el nombre del artículo';
    if (!formData.ubicacion_nombre.trim()) errors.ubicacion_nombre = 'Ingresa la ubicación';
    if (isStockTipo(formData.tipo_articulo) && !formData.cantidad) {
      errors.cantidad = 'Ingresa la cantidad';
    }
    if (formData.tipo_articulo === 'placa_balistica' && !formData.numero_serie.trim()) {
      errors.numero_serie = 'Ingresa el número de serie';
    }
    if (formData.tipo_articulo === 'placa_balistica' && !formData.fecha_caducidad) {
      errors.fecha_caducidad = 'Ingresa la fecha de caducidad';
    }
    if (formData.tipo_articulo === 'arma' && !formData.marca.trim()) {
      errors.marca = 'Ingresa la marca';
    }
    if (formData.tipo_articulo === 'arma' && !formData.numero_serie.trim()) {
      errors.numero_serie = 'Ingresa el número de serie';
    }
    if (formData.tipo_articulo === 'arma' && !formData.calibre.trim()) {
      errors.calibre = 'Ingresa el calibre';
    }
    if (formData.tipo_articulo === 'radio' && !formData.codigo_pantalla.trim()) {
      errors.codigo_pantalla = 'Ingresa el código de pantalla';
    }
    if (formData.tipo_articulo === 'radio' && !formData.codigo_radio.trim()) {
      errors.codigo_radio = 'Ingresa el número de serie';
    }
    if (formData.tipo_articulo === 'radio' && !formData.version.trim()) {
      errors.version = 'Ingresa la versión';
    }
    if (formData.tipo_articulo === 'radio' && !formData.modelo.trim()) {
      errors.modelo = 'Ingresa el modelo';
    }
    if (formData.tipo_articulo === 'radio' && !formData.marca.trim()) {
      errors.marca = 'Ingresa la marca';
    }

    if (Object.keys(errors).length > 0) {
      setArticuloErrors(errors);
      showMessage('error', Object.values(errors)[0]);
      return;
    }

    let cantidadFinal = formData.cantidad ? Number.parseInt(formData.cantidad, 10) : null;
    if (!cantidadFinal && !isStockTipo(formData.tipo_articulo)) {
      cantidadFinal = 1;
    }
    const payload = { ...formData, cantidad: cantidadFinal };
    const result = await inventarioService.createArticulo(payload);

    if (result.success) {
      showMessage('success', 'Artículo creado exitosamente');
      setShowArticuloModal(false);
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
      motivo: ''
    });
    setShowBajaModal(true);
  };

  const handleConfirmBaja = withBajaSubmit(async () => {
    if (!bajaTarget) return;
    const cantidad = isStockTipo(bajaTarget.tipo_articulo)
      ? Number.parseInt(bajaForm.cantidad, 10)
      : 1;
    const motivo = bajaForm.motivo.trim();

    if (!motivo) {
      showMessage('error', 'Ingresa el motivo de la baja');
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      showMessage('error', 'Ingresa una cantidad válida');
      return;
    }
    if (isStockTipo(bajaTarget.tipo_articulo) && cantidad > Number(bajaTarget.cantidad || 0)) {
      showMessage('error', 'La cantidad supera el stock disponible');
      return;
    }

    const result = await inventarioService.darBajaArticulo(bajaTarget.id, { cantidad, motivo });
    if (result.success) {
      showMessage('success', result.message || 'Artículo dado de baja');
      setShowBajaModal(false);
      setBajaTarget(null);
      await Promise.all([
        fetchArticulos(getActiveFilterParams(), true),
        loadBajas()
      ]);
    } else {
      showMessage('error', result.message);
    }
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await inventarioService.deleteArticulo(deleteTarget.id, deleteCantidad);
    if (result.success) {
      showMessage('success', 'Artículo eliminado');
      await fetchArticulos({}, true);
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
      await fetchArticulos({}, true);
    } else {
      showMessage('error', result.message);
    }
    setShowConfirmDeleteModal(false);
    setDeleteTarget(null);
  };

  // ── Movimiento handlers ──────────────────────────
  const openMovimientoModal = () => {
    setMovimientoForm({
      tipo_movimiento: 'traslado',
      fecha_movimiento: getTodayLocalISO(),
      ubicacion_destino_nombre: '',
      items: [{ articulo_id: '', cantidad: 1, talla: '' }]
    });
    setItemSearchTerms(['']);
    setItemDropdownOpen([false]);
    setMovimientoErrors({});
    setShowMovimientoModal(true);
  };

  const handleMovimientoFormChange = (e) => {
    const { name, value } = e.target;
    setMovimientoForm(prev => ({ ...prev, [name]: value }));
    setMovimientoErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleMovimientoItemChange = (index, field, value) => {
    setMovimientoForm(prev => ({
      ...prev,
      items: prev.items.map((item, idx) => idx === index ? { ...item, [field]: value } : item)
    }));
  };

  const handleAddMovimientoItem = () => {
    setMovimientoForm(prev => ({
      ...prev,
      items: [...prev.items, { articulo_id: '', cantidad: 1, talla: '' }]
    }));
    setItemSearchTerms(prev => [...prev, '']);
    setItemDropdownOpen(prev => [...prev, false]);
  };

  const handleRemoveMovimientoItem = (index) => {
    setMovimientoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
    setItemSearchTerms(prev => prev.filter((_, idx) => idx !== index));
    setItemDropdownOpen(prev => prev.filter((_, idx) => idx !== index));
  };

  const filterArticulos = (searchTerm) => {
    if (!searchTerm.trim()) return catalogArticulos;
    const term = searchTerm.toLowerCase();
    return catalogArticulos.filter(a => {
      const label = getArticuloLabel(a).toLowerCase();
      return label.includes(term);
    });
  };

  const selectArticuloForItem = (index, articulo) => {
    handleMovimientoItemChange(index, 'articulo_id', String(articulo.id));
    handleMovimientoItemChange(index, 'talla', articulo.talla || '');
    handleMovimientoItemChange(index, 'cantidad', 1);
    setItemSearchTerms(prev => prev.map((t, i) => i === index ? getArticuloLabel(articulo) : t));
    setItemDropdownOpen(prev => prev.map((v, i) => i === index ? false : v));
  };

  const clearArticuloForItem = (index) => {
    handleMovimientoItemChange(index, 'articulo_id', '');
    handleMovimientoItemChange(index, 'talla', '');
    handleMovimientoItemChange(index, 'cantidad', 1);
    setItemSearchTerms(prev => prev.map((t, i) => i === index ? '' : t));
  };

  const getArticuloLabel = (articulo) => {
    const name = articulo.nombre_articulo || 'Artículo';
    const ubicacion = articulo.ubicacion_nombre ? ` (${articulo.ubicacion_nombre})` : '';
    const serieValue = articulo.tipo_articulo === 'radio' ? articulo.codigo_radio : articulo.numero_serie;
    const serie = serieValue ? ` — ${serieValue}` : '';
    const talla = articulo.talla ? ` | Talla: ${articulo.talla}` : '';
    const cant = isStockTipo(articulo.tipo_articulo) && articulo.cantidad ? ` [x${articulo.cantidad}]` : '';
    return `${name}${serie}${talla}${cant}${ubicacion}`;
  };

  const handleCreateMovimiento = withMovimientoSubmit(async (e) => {
    e.preventDefault();
    const errors = {};
    if (!movimientoForm.tipo_movimiento) errors.tipo_movimiento = 'Selecciona un tipo de movimiento';
    if (!movimientoForm.fecha_movimiento) errors.fecha_movimiento = 'Selecciona la fecha del movimiento';
    if (movimientoForm.items.some(item => !item.articulo_id)) {
      errors.items = 'Selecciona los artículos del movimiento';
    }
    if (!movimientoForm.ubicacion_destino_nombre.trim()) {
      errors.ubicacion_destino_nombre = 'Ingresa la ubicación destino';
    }

    if (Object.keys(errors).length > 0) {
      setMovimientoErrors(errors);
      showMessage('error', Object.values(errors)[0]);
      return;
    }

    const payload = {
      ubicacion_destino_nombre: movimientoForm.ubicacion_destino_nombre,
      fecha_movimiento: movimientoForm.fecha_movimiento,
      items: movimientoForm.items.map(item => ({
        articulo_id: Number.parseInt(item.articulo_id, 10),
        cantidad: item.cantidad ? Number.parseInt(item.cantidad, 10) : 1,
        talla: item.talla || ''
      }))
    };

    const result = await inventarioService.createMovimiento(payload);
    if (result.success) {
      showMessage('success', 'Movimiento registrado exitosamente');
      setShowMovimientoModal(false);
      await fetchArticulos({}, true);
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
      estado: filters.estado
    });
    setShowExportModal(true);
  };

  const openMovimientosExportModal = () => {
    setMovimientosExportFilters({
      destino_id: movimientosFilters.destino_id,
      from: movimientosFilters.from,
      to: movimientosFilters.to
    });
    setShowMovimientosExportModal(true);
  };

  const handleExport = withArticulosExportSubmit(async () => {
    const params = {};
    if (exportFilters.tipo) params.tipo = exportFilters.tipo;
    if (exportFilters.ubicacion_id) params.ubicacion_id = exportFilters.ubicacion_id;
    if (exportFilters.estado) params.estado = exportFilters.estado;

    const result = await inventarioService.exportArticulosExcel(params);
    if (!result.success) {
      showMessage('error', result.message);
    }
    setShowExportModal(false);
  });

  const handleMovimientosExport = withMovimientosExportSubmit(async () => {
    const params = {};
    if (movimientosExportFilters.destino_id) params.destino_id = movimientosExportFilters.destino_id;
    if (movimientosExportFilters.from) params.from = movimientosExportFilters.from;
    if (movimientosExportFilters.to) params.to = movimientosExportFilters.to;

    const result = await inventarioService.exportMovimientosExcel(params);
    if (!result.success) {
      showMessage('error', result.message);
      return;
    }
    setShowMovimientosExportModal(false);
  });

  const handleBajasExport = withBajasExportSubmit(async () => {
    const result = await inventarioService.exportBajasArticulosExcel(getActiveBajasFilterParams());
    if (!result.success) {
      showMessage('error', result.message);
    }
  });

  // ── Helpers ──────────────────────────────────────
  const getTipoLabel = (tipo) => {
    const found = INVENTARIO_TIPOS.find(item => item.value === tipo);
    return found ? found.label : tipo;
  };

  const getCaducidadClass = (estado) => {
    if (estado === 'vencida') return 'is-expired';
    if (estado === 'proxima_a_vencer') return 'is-warning';
    return '';
  };

  const getSerieDisplay = (articulo) => (
    articulo.tipo_articulo === 'radio' ? (articulo.codigo_radio || '-') : (articulo.numero_serie || '-')
  );

  const emptyStateText = useMemo(() => {
    if (filters.tipo || filters.ubicacion_id || filters.estado || filters.search) {
      return 'No hay artículos que coincidan con los filtros.';
    }
    return 'No hay artículos registrados en inventario.';
  }, [filters]);

  const sortedArticulos = useMemo(() => {
    const getString = (value) => String(value || '').trim();
    const getNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };
    const getDate = (value) => {
      if (!value) return Number.NaN;
      const ts = new Date(value).getTime();
      return Number.isFinite(ts) ? ts : Number.NaN;
    };

    const rows = [...articulos];
    rows.sort((a, b) => {
      const direction = articulosSort.direction === 'asc' ? 1 : -1;
      const field = articulosSort.field;

      if (field === 'cantidad') {
        const aNum = getNumber(a.cantidad);
        const bNum = getNumber(b.cantidad);
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return (aNum - bNum) * direction;
      }

      if (field === 'fecha_caducidad') {
        const aDate = getDate(a.fecha_caducidad);
        const bDate = getDate(b.fecha_caducidad);
        if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
        if (Number.isNaN(aDate)) return 1;
        if (Number.isNaN(bDate)) return -1;
        return (aDate - bDate) * direction;
      }

      if (field === 'serie') {
        const aStr = getString(a.tipo_articulo === 'radio' ? a.codigo_radio : a.numero_serie);
        const bStr = getString(b.tipo_articulo === 'radio' ? b.codigo_radio : b.numero_serie);
        if (!aStr && !bStr) return 0;
        if (!aStr) return 1;
        if (!bStr) return -1;
        return aStr.localeCompare(bStr, 'es', { sensitivity: 'base', numeric: true }) * direction;
      }

      const aStr = getString(a[field]);
      const bStr = getString(b[field]);
      if (!aStr && !bStr) return 0;
      if (!aStr) return 1;
      if (!bStr) return -1;
      return aStr.localeCompare(bStr, 'es', { sensitivity: 'base', numeric: true }) * direction;
    });
    return rows;
  }, [articulos, articulosSort]);

  const articulosTotalPages = Math.max(1, Math.ceil(sortedArticulos.length / ROWS_PER_PAGE));
  const paginatedArticulos = sortedArticulos.slice((articulosPage - 1) * ROWS_PER_PAGE, articulosPage * ROWS_PER_PAGE);

  const handleArticulosSort = (field) => {
    setArticulosSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
    setArticulosPage(1);
  };

  const filteredMovimientos = useMemo(() => {
    return movimientos.filter((mov) => {
      const q = movimientosFilters.search.trim().toLowerCase();
      const searchable = [
        mov.articulos_movidos,
        mov.ubicacion_origen,
        mov.usuario
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (q && !searchable.includes(q)) return false;

      if (movimientosFilters.destino_id && String(mov.ubicacion_destino_id || '') !== String(movimientosFilters.destino_id)) {
        return false;
      }

      const movDate = parseDateSafe(mov.fecha_movimiento);
      if (!movDate) return false;

      if (movimientosFilters.from) {
        const fromDate = parseDateSafe(movimientosFilters.from);
        if (fromDate && movDate < fromDate) return false;
      }

      if (movimientosFilters.to) {
        const toDate = parseDateSafe(movimientosFilters.to);
        if (toDate && movDate > toDate) return false;
      }

      return true;
    });
  }, [movimientos, movimientosFilters]);

  const sortedMovimientos = useMemo(() => {
    const rows = [...filteredMovimientos];
    const direction = movimientosSort.direction === 'asc' ? 1 : -1;
    const field = movimientosSort.field;

    rows.sort((a, b) => {
      if (field === 'fecha_movimiento') {
        const aDate = parseDateSafe(a.fecha_movimiento)?.getTime() ?? Number.NaN;
        const bDate = parseDateSafe(b.fecha_movimiento)?.getTime() ?? Number.NaN;
        if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
        if (Number.isNaN(aDate)) return 1;
        if (Number.isNaN(bDate)) return -1;
        return (aDate - bDate) * direction;
      }

      if (field === 'items') {
        const aNum = Number(a.items);
        const bNum = Number(b.items);
        const aSafe = Number.isFinite(aNum) ? aNum : Number.NaN;
        const bSafe = Number.isFinite(bNum) ? bNum : Number.NaN;
        if (Number.isNaN(aSafe) && Number.isNaN(bSafe)) return 0;
        if (Number.isNaN(aSafe)) return 1;
        if (Number.isNaN(bSafe)) return -1;
        return (aSafe - bSafe) * direction;
      }

      const aStr = String(a[field] || '').trim();
      const bStr = String(b[field] || '').trim();
      if (!aStr && !bStr) return 0;
      if (!aStr) return 1;
      if (!bStr) return -1;
      return aStr.localeCompare(bStr, 'es', { sensitivity: 'base', numeric: true }) * direction;
    });

    return rows;
  }, [filteredMovimientos, movimientosSort]);

  const movimientosTotalPages = Math.max(1, Math.ceil(sortedMovimientos.length / ROWS_PER_PAGE));
  const paginatedMovimientos = sortedMovimientos.slice((movimientosPage - 1) * ROWS_PER_PAGE, movimientosPage * ROWS_PER_PAGE);
  const handleMovimientosSort = (field) => {
    setMovimientosSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
    setMovimientosPage(1);
  };

  const mobileArticuloCards = useMemo(() => paginatedArticulos.map((articulo) => (
    <article key={articulo.id} className="inventory-card">
      <div className="inventory-card-header">
        <div>
          <h3>{articulo.nombre_articulo || 'Artículo sin nombre'}</h3>
          <div className="inventory-card-meta">
            <span>{getTipoLabel(articulo.tipo_articulo)}</span>
          </div>
        </div>
        <span>{articulo.ubicacion_nombre || '-'}</span>
      </div>
      <div className="inventory-card-grid">
        <div>
          <strong>Serie</strong>
          <span>{getSerieDisplay(articulo)}</span>
        </div>
        <div>
          <strong>Cantidad</strong>
          <span>{articulo.cantidad ?? '-'}</span>
        </div>
        <div>
          <strong>Marca / Modelo</strong>
          <span>{[articulo.marca, articulo.modelo].filter(Boolean).join(' / ') || '-'}</span>
        </div>
        <div>
          <strong>Talla / Calibre</strong>
          <span>{[articulo.talla, articulo.calibre].filter(Boolean).join(' / ') || '-'}</span>
        </div>
        <div>
          <strong>Pantalla / Versión</strong>
          <span>{[articulo.codigo_pantalla, articulo.version].filter(Boolean).join(' / ') || '-'}</span>
        </div>
        <div>
          <strong>Caducidad</strong>
          <span className={`cell-date ${getCaducidadClass(articulo.estado_caducidad)}`}>{formatDate(articulo.fecha_caducidad)}</span>
        </div>
      </div>
      {showArticuloActions && (
        <div className="inventory-card-actions">
          {canDarBajaArticulo && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleOpenBaja(articulo)}
              type="button"
            >
              Dar de baja
            </button>
          )}
          {canDeleteArticulo && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleDeleteArticulo(articulo)}
              type="button"
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </article>
  )), [canDarBajaArticulo, canDeleteArticulo, paginatedArticulos, showArticuloActions]);

  const closeOverlay = (e, closeFn) => {
    if (e.target === e.currentTarget) closeFn();
  };

  // ── Render ───────────────────────────────────────
  return (
    <div className="inventario-container">
      {/* ── Header ── */}
      <header className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h1>Inventario</h1>
        </div>
        <div className="page-header-actions">
          {activeTab === 'articulos' && hasPermission('crear_articulo') && (
            <button className="btn btn-ghost btn-sm" onClick={handleOpenCreate}>Crear artículo</button>
          )}
          {activeTab === 'articulos' && hasPermission('exportar') && (
            <button className="btn btn-ghost btn-sm" onClick={openExportModal}>Generar reporte</button>
          )}
          {activeTab === 'movimientos' && hasPermission('crear_movimiento') && (
            <button className="btn btn-ghost btn-sm" onClick={openMovimientoModal}>Crear movimiento</button>
          )}
          {activeTab === 'movimientos' && hasPermission('exportar') && (
            <button className="btn btn-ghost btn-sm" onClick={openMovimientosExportModal}>Generar reporte</button>
          )}
          {activeTab === 'bajas' && hasPermission('exportar') && (
            <button className="btn btn-ghost btn-sm" onClick={handleBajasExport} disabled={isExportingBajas}>
              {isExportingBajas ? 'Generando...' : 'Generar reporte'}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm btn-icon-only"
            onClick={() => {
              if (activeTab === 'articulos') return fetchArticulos({}, true);
              if (activeTab === 'movimientos') return loadMovimientos();
              return loadBajas(getActiveBajasFilterParams());
            }}
            title="Actualizar datos"
          >↻</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="inventario-tabs">
        <button
          className={`tab ${activeTab === 'articulos' ? 'active' : ''}`}
          onClick={() => setActiveTab('articulos')}
        >
          Artículos
          {articulos.length > 0 && (
            <span className="tab-badge">{articulos.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'movimientos' ? 'active' : ''}`}
          onClick={() => setActiveTab('movimientos')}
        >
          Movimientos
          {movimientos.length > 0 && (
            <span className="tab-badge">{movimientos.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'bajas' ? 'active' : ''}`}
          onClick={() => setActiveTab('bajas')}
        >
          Dados de baja
          {bajas.length > 0 && (
            <span className="tab-badge">{bajas.length}</span>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/*  TAB: ARTÍCULOS                              */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'articulos' && (
        <div className="tab-content">
          {/* Filters */}
          <div className="ff-filter-row inventario-articulos-filter-row">
            <div className="ff-filter-card inventario-articulos-filter-card">
              <div className="ff-controls">
                <div className="ff-search">
                  <svg className="ff-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Nombre, serie, marca o modelo..."
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                  />
                </div>
                <div className="ff-state">
                  <span className="ff-state-label">Tipo</span>
                  <select name="tipo" value={filters.tipo} onChange={handleFilterChange}>
                    {INVENTARIO_TIPOS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ff-state">
                  <span className="ff-state-label">Ubicación</span>
                  <select name="ubicacion_id" value={filters.ubicacion_id} onChange={handleFilterChange}>
                    <option value="">Todas</option>
                    {ubicaciones.map(ub => (
                      <option key={ub.id} value={ub.id}>{ub.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="ff-state">
                  <span className="ff-state-label">Estado</span>
                  <select name="estado" value={filters.estado} onChange={handleFilterChange}>
                    {INVENTARIO_ESTADOS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="ff-filter-actions-card inventario-articulos-filter-actions-card">
              <div className="ff-actions">
                <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>Aplicar</button>
                <button className="ff-clear-btn" onClick={handleClearFilters}>Limpiar</button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              Cargando artículos...
            </div>
          ) : (
            <>
              <div className="table-responsive app-table-shell">
                <table className="app-table articulos-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('tipo_articulo')}>
                          Tipo
                          <span className={`th-sort-indicator${articulosSort.field === 'tipo_articulo' ? ' active' : ''}`}>
                            {articulosSort.field === 'tipo_articulo' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('nombre_articulo')}>
                          Artículo
                          <span className={`th-sort-indicator${articulosSort.field === 'nombre_articulo' ? ' active' : ''}`}>
                            {articulosSort.field === 'nombre_articulo' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('serie')}>
                          Serie
                          <span className={`th-sort-indicator${articulosSort.field === 'serie' ? ' active' : ''}`}>
                            {articulosSort.field === 'serie' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('cantidad')}>
                          Cant.
                          <span className={`th-sort-indicator${articulosSort.field === 'cantidad' ? ' active' : ''}`}>
                            {articulosSort.field === 'cantidad' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('talla')}>
                          Talla
                          <span className={`th-sort-indicator${articulosSort.field === 'talla' ? ' active' : ''}`}>
                            {articulosSort.field === 'talla' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('marca')}>
                          Marca
                          <span className={`th-sort-indicator${articulosSort.field === 'marca' ? ' active' : ''}`}>
                            {articulosSort.field === 'marca' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('modelo')}>
                          Modelo
                          <span className={`th-sort-indicator${articulosSort.field === 'modelo' ? ' active' : ''}`}>
                            {articulosSort.field === 'modelo' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('calibre')}>
                          Calibre
                          <span className={`th-sort-indicator${articulosSort.field === 'calibre' ? ' active' : ''}`}>
                            {articulosSort.field === 'calibre' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('codigo_pantalla')}>
                          Cód. Pant.
                          <span className={`th-sort-indicator${articulosSort.field === 'codigo_pantalla' ? ' active' : ''}`}>
                            {articulosSort.field === 'codigo_pantalla' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('version')}>
                          Versión
                          <span className={`th-sort-indicator${articulosSort.field === 'version' ? ' active' : ''}`}>
                            {articulosSort.field === 'version' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('fecha_caducidad')}>
                          Caducidad
                          <span className={`th-sort-indicator${articulosSort.field === 'fecha_caducidad' ? ' active' : ''}`}>
                            {articulosSort.field === 'fecha_caducidad' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleArticulosSort('ubicacion_nombre')}>
                          Ubicación
                          <span className={`th-sort-indicator${articulosSort.field === 'ubicacion_nombre' ? ' active' : ''}`}>
                            {articulosSort.field === 'ubicacion_nombre' && articulosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      {showArticuloActions && <th className={`col-actions app-col-actions ${articuloActionsClass}`}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArticulos.length > 0 ? (
                      paginatedArticulos.map((articulo, idx) => (
                        <tr key={articulo.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                          <td className="cell-compact">{getTipoLabel(articulo.tipo_articulo)}</td>
                          <td className="cell-articulo">{articulo.nombre_articulo || '-'}</td>
                          <td className="cell-serie">{getSerieDisplay(articulo)}</td>
                          <td className="cell-cantidad app-cell-qty">{articulo.cantidad ?? '-'}</td>
                          <td className="cell-compact">{articulo.talla || '-'}</td>
                          <td className="cell-compact">{articulo.marca || '-'}</td>
                          <td className="cell-compact">{articulo.modelo || '-'}</td>
                          <td className="cell-compact">{articulo.calibre || '-'}</td>
                          <td className="cell-code">{articulo.codigo_pantalla || '-'}</td>
                          <td className="cell-compact">{articulo.version || '-'}</td>
                          <td className={`cell-date app-cell-date ${getCaducidadClass(articulo.estado_caducidad)}`}>{formatDate(articulo.fecha_caducidad)}</td>
                          <td>{articulo.ubicacion_nombre || '-'}</td>
                          {showArticuloActions && (
                            <td className={`col-actions app-col-actions ${articuloActionsClass}`}>
                              <div className="action-buttons app-table-actions">
                                {canDarBajaArticulo && (
                                  <button
                                    className="action-btn action-btn-baja"
                                    onClick={() => handleOpenBaja(articulo)}
                                    title="Dar de baja"
                                    type="button"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                      <circle cx="12" cy="12" r="8"/>
                                      <path d="M8 12h8"/>
                                    </svg>
                                  </button>
                                )}
                                {canDeleteArticulo && (
                                  <button
                                    className="action-btn action-btn-del"
                                    onClick={() => handleDeleteArticulo(articulo)}
                                    title="Eliminar artículo"
                                    type="button"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                      <path d="M10 11v6M14 11v6"/>
                                      <path d="M9 6V4h6v2"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={showArticuloActions ? 13 : 12} className="text-center">
                          {emptyStateText}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {articulosTotalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setArticulosPage(p => Math.max(1, p - 1))}
                    disabled={articulosPage === 1}
                  >‹ Anterior</button>
                  <span className="pagination-info">
                    Página <span className="pagination-count">{articulosPage}</span> de {articulosTotalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setArticulosPage(p => Math.min(articulosTotalPages, p + 1))}
                    disabled={articulosPage === articulosTotalPages}
                  >Siguiente ›</button>
                </div>
              )}
              {articulos.length > 0 && (
                <div className="records-mobile">
                  {mobileArticuloCards}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  TAB: DADOS DE BAJA                          */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'bajas' && (
        <div className="tab-content">
          <div className="ff-filter-row inventario-bajas-filter-row">
            <div className="ff-filter-card inventario-bajas-filter-card">
              <div className="ff-controls">
                <div className="ff-search">
                  <svg className="ff-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    name="search"
                    value={bajasFiltersDraft.search}
                    onChange={handleBajasDraftChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyBajasFilters()}
                    placeholder="Buscar artículo, serie, motivo, ubicación o usuario..."
                  />
                </div>
                <div className="ff-dates">
                  <div className="ff-date-field">
                    <span className="ff-date-label">Desde</span>
                    <input
                      type="date"
                      name="from"
                      value={bajasFiltersDraft.from}
                      onChange={handleBajasDraftChange}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyBajasFilters()}
                    />
                  </div>
                  <div className="ff-date-field">
                    <span className="ff-date-label">Hasta</span>
                    <input
                      type="date"
                      name="to"
                      value={bajasFiltersDraft.to}
                      onChange={handleBajasDraftChange}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyBajasFilters()}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="ff-filter-actions-card inventario-bajas-filter-actions-card">
              <div className="ff-actions">
                <button className="btn btn-primary btn-sm" onClick={handleApplyBajasFilters}>Aplicar</button>
                <button className="ff-clear-btn" onClick={handleClearBajasFilters}>Limpiar</button>
              </div>
            </div>
          </div>

          {bajasLoading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              Cargando artículos dados de baja...
            </div>
          ) : (
            <div className="table-responsive app-table-shell">
              <table className="app-table bajas-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Artículo</th>
                    <th>Serie</th>
                    <th>Cantidad</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Ubicación</th>
                    <th>Usuario</th>
                    <th className="cell-motivo-heading">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {bajas.length > 0 ? (
                    bajas.map((baja, idx) => (
                      <tr key={baja.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td className="app-cell-date">{formatDate(baja.fecha_baja)}</td>
                        <td className="cell-compact">{getTipoLabel(baja.tipo_articulo)}</td>
                        <td className="cell-articulo">{baja.nombre_articulo || '-'}</td>
                        <td className="cell-serie">{getSerieDisplay(baja)}</td>
                        <td className="app-cell-qty">{baja.cantidad ?? '-'}</td>
                        <td className="cell-compact">{baja.marca || '-'}</td>
                        <td className="cell-compact">{baja.modelo || '-'}</td>
                        <td>{baja.ubicacion_nombre || '-'}</td>
                        <td>{baja.usuario || '-'}</td>
                        <td className="cell-motivo">
                          <span className="cell-motivo-text" title={baja.motivo || '-'}>
                            {baja.motivo || '-'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="text-center">No hay artículos dados de baja.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  TAB: MOVIMIENTOS                            */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'movimientos' && (
        <div className="tab-content">
          {movimientosLoading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              Cargando movimientos...
            </div>
          ) : (
            <>
              <div className="ff-filter-row inventario-movimientos-filter-row">
                <div className="ff-filter-card inventario-movimientos-filter-card">
                  <div className="ff-controls">
                    <div className="ff-search">
                      <svg className="ff-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        name="search"
                        value={movimientosFiltersDraft.search}
                        onChange={handleMovimientosDraftChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyMovimientosFilters()}
                        placeholder="Buscar en artículos, origen o usuario..."
                      />
                    </div>
                    <div className="ff-state movimientos-destino-filter">
                      <span className="ff-state-label">Destino</span>
                      <select
                        name="destino_id"
                        value={movimientosFiltersDraft.destino_id}
                        onChange={handleMovimientosDraftChange}
                      >
                        <option value="">Todos</option>
                        {ubicaciones.map(ub => (
                          <option key={ub.id} value={ub.id}>{ub.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ff-dates">
                      <div className="ff-date-field">
                        <span className="ff-date-label">Desde</span>
                        <input
                          type="date"
                          name="from"
                          value={movimientosFiltersDraft.from}
                          onChange={handleMovimientosDraftChange}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyMovimientosFilters()}
                        />
                      </div>
                      <div className="ff-date-field">
                        <span className="ff-date-label">Hasta</span>
                        <input
                          type="date"
                          name="to"
                          value={movimientosFiltersDraft.to}
                          onChange={handleMovimientosDraftChange}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyMovimientosFilters()}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ff-filter-actions-card inventario-movimientos-filter-actions-card">
                  <div className="ff-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleApplyMovimientosFilters}>Aplicar</button>
                    <button className="ff-clear-btn" onClick={handleClearMovimientosFilters}>Limpiar</button>
                  </div>
                </div>
              </div>

              <div className="table-responsive app-table-shell">
                <table className="app-table movimientos-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleMovimientosSort('fecha_movimiento')}>
                          Fecha
                          <span className={`th-sort-indicator${movimientosSort.field === 'fecha_movimiento' ? ' active' : ''}`}>
                            {movimientosSort.field === 'fecha_movimiento' && movimientosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleMovimientosSort('items')}>
                          Cant. Artículos
                          <span className={`th-sort-indicator${movimientosSort.field === 'items' ? ' active' : ''}`}>
                            {movimientosSort.field === 'items' && movimientosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleMovimientosSort('articulos_movidos')}>
                          Artículos
                          <span className={`th-sort-indicator${movimientosSort.field === 'articulos_movidos' ? ' active' : ''}`}>
                            {movimientosSort.field === 'articulos_movidos' && movimientosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleMovimientosSort('ubicacion_origen')}>
                          Origen
                          <span className={`th-sort-indicator${movimientosSort.field === 'ubicacion_origen' ? ' active' : ''}`}>
                            {movimientosSort.field === 'ubicacion_origen' && movimientosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleMovimientosSort('ubicacion_destino')}>
                          Destino
                          <span className={`th-sort-indicator${movimientosSort.field === 'ubicacion_destino' ? ' active' : ''}`}>
                            {movimientosSort.field === 'ubicacion_destino' && movimientosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleMovimientosSort('usuario')}>
                          Usuario
                          <span className={`th-sort-indicator${movimientosSort.field === 'usuario' ? ' active' : ''}`}>
                            {movimientosSort.field === 'usuario' && movimientosSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th className="col-actions app-col-actions app-col-actions--single"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMovimientos.length > 0 ? (
                      paginatedMovimientos.map((mov, idx) => (
                        <tr key={mov.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                          <td className="app-cell-date">{formatDate(mov.fecha_movimiento)}</td>
                          <td className="app-cell-qty">{mov.items}</td>
                          <td>{mov.articulos_movidos || '-'}</td>
                          <td>{mov.ubicacion_origen || '-'}</td>
                          <td>{mov.ubicacion_destino || '-'}</td>
                          <td>{mov.usuario || '-'}</td>
                          <td className="col-actions app-col-actions app-col-actions--single">
                            <div className="action-buttons app-table-actions">
                              <button
                                className="action-btn action-btn-pdf"
                                type="button"
                                title="Descargar PDF"
                                onClick={() => handleDownloadPdf(mov)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center">No hay movimientos registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {movimientosTotalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setMovimientosPage(p => Math.max(1, p - 1))}
                    disabled={movimientosPage === 1}
                  >‹ Anterior</button>
                  <span className="pagination-info">
                    Página <span className="pagination-count">{movimientosPage}</span> de {movimientosTotalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setMovimientosPage(p => Math.min(movimientosTotalPages, p + 1))}
                    disabled={movimientosPage === movimientosTotalPages}
                  >Siguiente ›</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: NUEVO ARTÍCULO                       */}
      {/* ════════════════════════════════════════════ */}
      {showArticuloModal && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowArticuloModal(false))}>
          <div className="modal modal-articulo">
            <div className="modal-header">
              <h3>Nuevo artículo</h3>
              <button className="modal-close" onClick={() => setShowArticuloModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveArticulo} autoComplete="off" data-lpignore="true" data-1p-ignore="true">
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="art-tipo">Tipo</label>
                    <select
                      id="art-tipo"
                      name="tipo_articulo"
                      value={formData.tipo_articulo}
                      onChange={handleTipoChange}
                      className={articuloErrors.tipo_articulo ? 'input-warning' : ''}
                    >
                      <option value="">Selecciona un tipo</option>
                      {ARTICULO_TIPOS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {articuloErrors.tipo_articulo ? (
                      <div className="inventory-field-warning" role="alert">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 9v4m0 4h.01M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{articuloErrors.tipo_articulo}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="form-group">
                    <label htmlFor="art-nombre">Nombre del Artículo</label>
                    <input id="art-nombre" type="text" name="nombre_articulo" value={formData.nombre_articulo} onChange={handleFormChange} placeholder="Ej: Chaleco antibalas" required />
                    {articuloErrors.nombre_articulo ? <span className="field-error">{articuloErrors.nombre_articulo}</span> : null}
                  </div>

                  {isStockTipo(formData.tipo_articulo) && (
                    <>
                      <div className="form-group">
                        <label htmlFor="art-cantidad">Cantidad</label>
                        <input id="art-cantidad" type="number" name="cantidad" value={formData.cantidad} onChange={handleFormChange} min="1" placeholder="1" required />
                        {articuloErrors.cantidad ? <span className="field-error">{articuloErrors.cantidad}</span> : null}
                      </div>
                      {formData.tipo_articulo === 'equipo' && (
                        <div className="form-group">
                          <label htmlFor="art-talla">Talla <span className="label-optional">(opcional)</span></label>
                          <input id="art-talla" type="text" name="talla" value={formData.talla} onChange={handleFormChange} placeholder="S, M, L, XL..." />
                        </div>
                      )}
                    </>
                  )}

                  {formData.tipo_articulo === 'placa_balistica' && (
                    <>
                      <div className="form-group">
                        <label htmlFor="art-serie-pb">Número de Serie</label>
                        <input id="art-serie-pb" type="text" name="numero_serie" value={formData.numero_serie} onChange={handleFormChange} placeholder="Ej: PB-001" required />
                        {articuloErrors.numero_serie ? <span className="field-error">{articuloErrors.numero_serie}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-caducidad">Fecha de Caducidad</label>
                        <input id="art-caducidad" type="date" name="fecha_caducidad" value={formData.fecha_caducidad} onChange={handleFormChange} required />
                        {articuloErrors.fecha_caducidad ? <span className="field-error">{articuloErrors.fecha_caducidad}</span> : null}
                      </div>
                    </>
                  )}

                  {formData.tipo_articulo === 'arma' && (
                    <>
                      <div className="form-group">
                        <label htmlFor="art-marca-arma">Marca</label>
                        <input id="art-marca-arma" type="text" name="marca" value={formData.marca} onChange={handleFormChange} placeholder="Ej: Glock" required />
                        {articuloErrors.marca ? <span className="field-error">{articuloErrors.marca}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-modelo-arma">Modelo</label>
                        <input id="art-modelo-arma" type="text" name="modelo" value={formData.modelo} onChange={handleFormChange} placeholder="Ej: G19" />
                        {articuloErrors.modelo ? <span className="field-error">{articuloErrors.modelo}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-serie-arma">Número de Serie</label>
                        <input id="art-serie-arma" type="text" name="numero_serie" value={formData.numero_serie} onChange={handleFormChange} placeholder="Ej: ABC123" required />
                        {articuloErrors.numero_serie ? <span className="field-error">{articuloErrors.numero_serie}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-calibre">Calibre</label>
                        <input id="art-calibre" type="text" name="calibre" value={formData.calibre} onChange={handleFormChange} placeholder="Ej: 9mm" required />
                        {articuloErrors.calibre ? <span className="field-error">{articuloErrors.calibre}</span> : null}
                      </div>
                    </>
                  )}

                  {formData.tipo_articulo === 'radio' && (
                    <>
                      <div className="form-group">
                        <label htmlFor="art-cod-pantalla">Código Pantalla</label>
                        <input id="art-cod-pantalla" type="text" name="codigo_pantalla" value={formData.codigo_pantalla} onChange={handleFormChange} placeholder="Ej: P-001" required autoComplete="off" data-lpignore="true" data-1p-ignore="true" />
                        {articuloErrors.codigo_pantalla ? <span className="field-error">{articuloErrors.codigo_pantalla}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-cod-radio">Número de Serie</label>
                        <input id="art-cod-radio" type="text" name="codigo_radio" value={formData.codigo_radio} onChange={handleFormChange} placeholder="Ej: R-001" required autoComplete="off" data-lpignore="true" data-1p-ignore="true" />
                        {articuloErrors.codigo_radio ? <span className="field-error">{articuloErrors.codigo_radio}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-version">Versión</label>
                        <input id="art-version" type="text" name="version" value={formData.version} onChange={handleFormChange} placeholder="Ej: 2.1" required autoComplete="off" data-lpignore="true" data-1p-ignore="true" />
                        {articuloErrors.version ? <span className="field-error">{articuloErrors.version}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-marca-radio">Marca</label>
                        <input id="art-marca-radio" type="text" name="marca" value={formData.marca} onChange={handleFormChange} placeholder="Ej: Motorola" required autoComplete="off" data-lpignore="true" data-1p-ignore="true" />
                        {articuloErrors.marca ? <span className="field-error">{articuloErrors.marca}</span> : null}
                      </div>
                      <div className="form-group">
                        <label htmlFor="art-modelo-radio">Modelo</label>
                        <input id="art-modelo-radio" type="text" name="modelo" value={formData.modelo} onChange={handleFormChange} placeholder="Ej: Motorola APX" required autoComplete="off" data-lpignore="true" data-1p-ignore="true" />
                        {articuloErrors.modelo ? <span className="field-error">{articuloErrors.modelo}</span> : null}
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label htmlFor="art-ubicacion">Ubicación</label>
                    <input id="art-ubicacion" type="text" name="ubicacion_nombre" value={formData.ubicacion_nombre} onChange={handleFormChange} placeholder="Ej: Bodega principal" required />
                    {articuloErrors.ubicacion_nombre ? <span className="field-error">{articuloErrors.ubicacion_nombre}</span> : null}
                  </div>
                </div>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-primary" type="submit" disabled={isSavingArticulo}>
                  {isSavingArticulo ? <><span className="spinner spinner--sm" />Guardando…</> : 'Crear Artículo'}
                </button>
                <button className="btn btn-modal-clear" type="button" onClick={() => setShowArticuloModal(false)} disabled={isSavingArticulo}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: NUEVO MOVIMIENTO                     */}
      {/* ════════════════════════════════════════════ */}
      {showMovimientoModal && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowMovimientoModal(false))}>
          <div className="modal modal-movimiento">
            <div className="modal-header">
              <h3>Nuevo movimiento</h3>
              <button className="modal-close" onClick={() => setShowMovimientoModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateMovimiento}>
              <div className="modal-body">
                {/* Items list */}
                <div className="movimiento-items-section">
                  <div className="movimiento-items-header">
                    <h4>Artículos a mover</h4>
                    <button className="btn btn-sm btn-primary" type="button" onClick={handleAddMovimientoItem}>Agregar</button>
                  </div>
                  {movimientoForm.items.map((item, index) => {
                    const selectedArticulo = catalogArticulos.find(a => String(a.id) === String(item.articulo_id));
                    const isStockArticulo = selectedArticulo && isStockTipo(selectedArticulo.tipo_articulo);
                    const disableCantidad = selectedArticulo && !isStockArticulo;
                    const hasSize = Boolean(selectedArticulo?.talla);
                    const maxCantidad = isStockArticulo && selectedArticulo?.cantidad ? selectedArticulo.cantidad : 1;
                    const searchTerm = itemSearchTerms[index] || '';
                    const isOpen = itemDropdownOpen[index] || false;
                    const filteredList = filterArticulos(searchTerm);
                    const hasSelection = Boolean(item.articulo_id);
                    return (
                      <div className="movimiento-item-row" key={`mov-item-${index}`}>
                        <div className="item-search-wrapper">
                          <div className="item-search-input-row">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemSearchTerms(prev => prev.map((t, i) => i === index ? val : t));
                                setItemDropdownOpen(prev => prev.map((v, i) => i === index ? true : v));
                                if (hasSelection) clearArticuloForItem(index);
                              }}
                              onFocus={() => {
                                if (!hasSelection) {
                                  setItemDropdownOpen(prev => prev.map((v, i) => i === index ? true : v));
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setItemDropdownOpen(prev => prev.map((v, i) => i === index ? false : v));
                                }, 150);
                              }}
                              placeholder="Buscar artículo..."
                              className={hasSelection ? 'search-selected' : ''}
                            />
                            {hasSelection && (
                              <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => {
                                  clearArticuloForItem(index);
                                  setItemDropdownOpen(prev => prev.map((v, i) => i === index ? true : v));
                                }}
                                title="Cambiar artículo"
                              >×</button>
                            )}
                          </div>
                          {isOpen && !hasSelection && (
                            <ul className="item-search-dropdown">
                              {filteredList.length > 0 ? (
                                filteredList.map(a => (
                                  <li key={a.id} onMouseDown={() => selectArticuloForItem(index, a)}>
                                    <span className="dropdown-name">{a.nombre_articulo || 'Artículo'}</span>
                                    {(a.tipo_articulo === 'radio' ? a.codigo_radio : a.numero_serie) && (
                                      <span className="dropdown-serie">{a.tipo_articulo === 'radio' ? a.codigo_radio : a.numero_serie}</span>
                                    )}
                                    {a.talla && <span className="dropdown-talla">Talla: {a.talla}</span>}
                                    {isStockTipo(a.tipo_articulo) && a.cantidad && <span className="dropdown-qty">x{a.cantidad}</span>}
                                    {a.ubicacion_nombre && <span className="dropdown-ubi">{a.ubicacion_nombre}</span>}
                                  </li>
                                ))
                              ) : (
                                <li className="dropdown-empty">Sin resultados</li>
                              )}
                            </ul>
                          )}
                        </div>
                        <div className="item-cantidad">
                          <input
                            type="number"
                            min="1"
                            max={maxCantidad}
                            value={item.cantidad}
                            disabled={disableCantidad}
                            onChange={(e) => {
                              const val = Number.parseInt(e.target.value, 10) || 1;
                              handleMovimientoItemChange(index, 'cantidad', Math.min(val, maxCantidad));
                            }}
                            placeholder="Cant."
                          />
                        </div>
                        {hasSize && (
                          <div className="item-talla">
                            <input
                              type="text"
                              value={item.talla || ''}
                              readOnly
                              className="talla-readonly"
                              title={`Talla fija: ${item.talla}`}
                            />
                          </div>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          type="button"
                          onClick={() => handleRemoveMovimientoItem(index)}
                          disabled={movimientoForm.items.length === 1}
                          title="Quitar artículo"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  {movimientoErrors.items ? <span className="field-error">{movimientoErrors.items}</span> : null}
                </div>

                {/* Date */}
                <div className="form-group">
                  <label htmlFor="mov-fecha">Fecha</label>
                  <input
                    id="mov-fecha"
                    type="date"
                    name="fecha_movimiento"
                    value={movimientoForm.fecha_movimiento}
                    onChange={handleMovimientoFormChange}
                    required
                  />
                  {movimientoErrors.fecha_movimiento ? <span className="field-error">{movimientoErrors.fecha_movimiento}</span> : null}
                </div>

                {/* Destination */}
                <div className="form-group">
                  <label htmlFor="mov-destino">Ubicación Destino</label>
                  <input
                    id="mov-destino"
                    type="text"
                    name="ubicacion_destino_nombre"
                    value={movimientoForm.ubicacion_destino_nombre}
                    onChange={handleMovimientoFormChange}
                    placeholder="Ej: Puesto Norte"
                    required
                  />
                  {movimientoErrors.ubicacion_destino_nombre ? <span className="field-error">{movimientoErrors.ubicacion_destino_nombre}</span> : null}
                </div>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-primary" type="submit" disabled={isSavingMovimiento}>
                  {isSavingMovimiento ? <><span className="spinner spinner--sm" />Guardando…</> : 'Guardar Movimiento'}
                </button>
                <button className="btn btn-modal-clear" type="button" onClick={() => setShowMovimientoModal(false)} disabled={isSavingMovimiento}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: EXPORTAR INVENTARIO                 */}
      {/* ════════════════════════════════════════════ */}
      {showExportModal && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowExportModal(false))}>
          <div className="modal modal-export" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reporte de inventario</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="export-form-grid">
                <div className="form-group">
                  <label htmlFor="export-tipo">Tipo</label>
                  <select
                    id="export-tipo"
                    value={exportFilters.tipo}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, tipo: e.target.value }))}
                  >
                    {INVENTARIO_TIPOS.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="export-ubicacion">Ubicación</label>
                  <select
                    id="export-ubicacion"
                    value={exportFilters.ubicacion_id}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, ubicacion_id: e.target.value }))}
                  >
                    <option value="">Todas las ubicaciones</option>
                    {ubicaciones.map(ub => (
                      <option key={ub.id} value={ub.id}>{ub.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="export-estado">Estado</label>
                  <select
                    id="export-estado"
                    value={exportFilters.estado}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, estado: e.target.value }))}
                  >
                    {INVENTARIO_ESTADOS.map(estado => (
                      <option key={estado.value} value={estado.value}>{estado.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-buttons export-modal-actions">
              <button className="btn btn-primary" onClick={handleExport} disabled={isExportingArticulos}>
                {isExportingArticulos ? <><span className="spinner spinner--sm" />Generando…</> : 'Exportar reporte'}
              </button>
              <button className="btn btn-modal-clear" onClick={() => setShowExportModal(false)} disabled={isExportingArticulos}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: EXPORTAR MOVIMIENTOS                */}
      {/* ════════════════════════════════════════════ */}
      {showMovimientosExportModal && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowMovimientosExportModal(false))}>
          <div className="modal modal-export" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reporte de movimientos</h3>
              <button className="modal-close" onClick={() => setShowMovimientosExportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="export-form-grid">
                <div className="form-group">
                  <label htmlFor="mov-export-destino">Destino</label>
                  <select
                    id="mov-export-destino"
                    value={movimientosExportFilters.destino_id}
                    onChange={(e) => setMovimientosExportFilters(prev => ({ ...prev, destino_id: e.target.value }))}
                  >
                    <option value="">Todos los destinos</option>
                    {ubicaciones.map(ub => (
                      <option key={ub.id} value={ub.id}>{ub.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="mov-export-from">Desde</label>
                  <input
                    id="mov-export-from"
                    type="date"
                    value={movimientosExportFilters.from}
                    onChange={(e) => setMovimientosExportFilters(prev => ({ ...prev, from: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mov-export-to">Hasta</label>
                  <input
                    id="mov-export-to"
                    type="date"
                    value={movimientosExportFilters.to}
                    onChange={(e) => setMovimientosExportFilters(prev => ({ ...prev, to: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-buttons export-modal-actions">
              <button className="btn btn-primary" onClick={handleMovimientosExport} disabled={isExportingMovimientos}>
                {isExportingMovimientos ? <><span className="spinner spinner--sm" />Generando…</> : 'Exportar reporte'}
              </button>
              <button className="btn btn-modal-clear" onClick={() => setShowMovimientosExportModal(false)} disabled={isExportingMovimientos}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: DAR DE BAJA                          */}
      {/* ════════════════════════════════════════════ */}
      {showBajaModal && bajaTarget && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowBajaModal(false))}>
          <div className="modal modal-baja" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dar de baja artículo</h3>
              <button className="modal-close" onClick={() => setShowBajaModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="baja-summary">
                <div>
                  <span>Artículo</span>
                  <strong>{bajaTarget.nombre_articulo || getSerieDisplay(bajaTarget) || bajaTarget.id}</strong>
                </div>
                <div>
                  <span>Tipo</span>
                  <strong>{getTipoLabel(bajaTarget.tipo_articulo)}</strong>
                </div>
                <div>
                  <span>Serie</span>
                  <strong>{getSerieDisplay(bajaTarget)}</strong>
                </div>
                <div>
                  <span>Ubicación</span>
                  <strong>{bajaTarget.ubicacion_nombre || '-'}</strong>
                </div>
              </div>
              {isStockTipo(bajaTarget.tipo_articulo) ? (
                <div className="form-group">
                  <label htmlFor="baja-cantidad">Cantidad a dar de baja</label>
                  <input
                    id="baja-cantidad"
                    type="number"
                    min="1"
                    max={bajaTarget.cantidad}
                    value={bajaForm.cantidad}
                    onChange={(e) => setBajaForm(prev => ({ ...prev, cantidad: e.target.value }))}
                  />
                  <p className="delete-hint">Disponible: {bajaTarget.cantidad} unidades</p>
                </div>
              ) : (
                <div className="baja-notice">Este artículo se dará de baja por completo.</div>
              )}
              <div className="form-group">
                <label htmlFor="baja-motivo">Motivo de la baja</label>
                <textarea
                  id="baja-motivo"
                  rows="4"
                  value={bajaForm.motivo}
                  onChange={(e) => setBajaForm(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Describe por qué se da de baja este artículo"
                  required
                />
              </div>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-modal-clear" onClick={() => setShowBajaModal(false)} disabled={isSavingBaja}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleConfirmBaja} disabled={isSavingBaja}>
                {isSavingBaja ? <><span className="spinner spinner--sm" />Guardando…</> : 'Dar de baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: ELIMINAR CANTIDAD (stock)            */}
      {/* ════════════════════════════════════════════ */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowDeleteModal(false))}>
          <div className="modal modal-delete">
            <div className="modal-header">
              <h3>Eliminar cantidad</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="delete-context">
                Artículo: <strong>{deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}</strong>
              </p>
              <div className="form-group">
                <label>Cantidad a eliminar</label>
                <input
                  type="number"
                  min="1"
                  max={deleteTarget.cantidad}
                  value={deleteCantidad}
                  onChange={(e) => setDeleteCantidad(parseInt(e.target.value || '1', 10))}
                />
              </div>
              <p className="delete-hint">Disponible: {deleteTarget.cantidad} unidades</p>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-modal-clear" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: CONFIRMAR ELIMINACIÓN                */}
      {/* ════════════════════════════════════════════ */}
      {showConfirmDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowConfirmDeleteModal(false))}>
          <div className="modal modal-delete">
            <div className="modal-header">
              <h3>Confirmar eliminación</h3>
              <button className="modal-close" onClick={() => setShowConfirmDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="delete-context">
                ¿Estás seguro de eliminar <strong>{deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}</strong>?
              </p>
              <p className="delete-warning">Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-modal-clear" onClick={() => setShowConfirmDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleConfirmSimpleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
