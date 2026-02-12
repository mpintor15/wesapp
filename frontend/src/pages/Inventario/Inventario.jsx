import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import inventarioService from '../../services/inventarioService';
import './Inventario.css';

const INVENTARIO_TIPOS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'equipo', label: 'Equipo' },
  { value: 'placa_balistica', label: 'Placa Balística' },
  { value: 'arma', label: 'Arma' }
];

const INVENTARIO_ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'sin_alerta', label: 'Sin alerta' },
  { value: 'vigente', label: 'Vigente' },
  { value: 'proxima_a_vencer', label: 'Próxima a vencer' },
  { value: 'vencida', label: 'Vencida' }
];

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-EC');
};

const Inventario = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Data
  const [articulos, setArticulos] = useState([]);
  const [catalogArticulos, setCatalogArticulos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [movimientoDetalles, setMovimientoDetalles] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [movimientosLoading, setMovimientosLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('articulos');

  // Modals
  const [showArticuloModal, setShowArticuloModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showMovimientoDetalleModal, setShowMovimientoDetalleModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteCantidad, setDeleteCantidad] = useState(1);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  // Forms
  const [movimientoForm, setMovimientoForm] = useState({
    tipo_movimiento: 'traslado',
    fecha_movimiento: new Date().toISOString().split('T')[0],
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
    ubicacion_nombre: ''
  });
  const [filters, setFilters] = useState({
    tipo: '',
    ubicacion_id: '',
    estado: '',
    search: ''
  });
  const [exportFilters, setExportFilters] = useState({
    tipo: '',
    ubicacion_id: '',
    estado: ''
  });

  // ── Auto-dismiss messages ────────────────────────
  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
  }, []);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // ── Data loading ─────────────────────────────────
  useEffect(() => {
    loadInitialData();
    loadMovimientos();
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
    setLoading(true);
    await fetchArticulos(getActiveFilterParams());
    setLoading(false);
  };

  const handleClearFilters = async () => {
    setFilters({ tipo: '', ubicacion_id: '', estado: '', search: '' });
    setLoading(true);
    await fetchArticulos({}, true);
    setLoading(false);
  };

  // ── Artículo CRUD ────────────────────────────────
  const resetFormData = (overrides = {}) => {
    setFormData({
      tipo_articulo: '', nombre_articulo: '', cantidad: '', talla: '',
      marca: '', modelo: '', numero_serie: '', calibre: '',
      fecha_caducidad: '', ubicacion_nombre: '', ...overrides
    });
  };

  const handleOpenCreate = () => {
    resetFormData();
    setShowArticuloModal(true);
  };

  const handleTipoChange = (e) => {
    const nextTipo = e.target.value;
    setFormData(prev => {
      const base = { ...prev, tipo_articulo: nextTipo };
      if (nextTipo === 'equipo') {
        return { ...base, marca: '', modelo: '', numero_serie: '', calibre: '', fecha_caducidad: '' };
      }
      if (nextTipo === 'placa_balistica') {
        return { ...base, cantidad: '', talla: '', marca: '', modelo: '', calibre: '' };
      }
      if (nextTipo === 'arma') {
        return { ...base, cantidad: '', talla: '', fecha_caducidad: '' };
      }
      return base;
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveArticulo = async (e) => {
    e.preventDefault();
    if (!formData.tipo_articulo) { showMessage('error', 'Selecciona un tipo de artículo'); return; }
    if (!formData.nombre_articulo) { showMessage('error', 'El nombre del artículo es requerido'); return; }
    if (!formData.ubicacion_nombre) { showMessage('error', 'Ingresa la ubicación'); return; }
    if (formData.tipo_articulo === 'equipo' && !formData.cantidad) {
      showMessage('error', 'La cantidad es requerida para equipos'); return;
    }

    let cantidadFinal = formData.cantidad ? parseInt(formData.cantidad, 10) : null;
    if (!cantidadFinal && (formData.tipo_articulo === 'placa_balistica' || formData.tipo_articulo === 'arma')) {
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
  };

  const handleDeleteArticulo = (articulo) => {
    if (articulo.tipo_articulo === 'equipo' && articulo.cantidad && articulo.cantidad > 1) {
      setDeleteTarget(articulo);
      setDeleteCantidad(1);
      setShowDeleteModal(true);
      return;
    }
    setDeleteTarget(articulo);
    setShowConfirmDeleteModal(true);
  };

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
      fecha_movimiento: new Date().toISOString().split('T')[0],
      ubicacion_destino_nombre: '',
      items: [{ articulo_id: '', cantidad: 1, talla: '' }]
    });
    setItemSearchTerms(['']);
    setItemDropdownOpen([false]);
    setShowMovimientoModal(true);
  };

  const handleMovimientoFormChange = (e) => {
    const { name, value } = e.target;
    setMovimientoForm(prev => ({ ...prev, [name]: value }));
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
    const serie = articulo.numero_serie ? ` — ${articulo.numero_serie}` : '';
    const talla = articulo.talla ? ` | Talla: ${articulo.talla}` : '';
    const cant = articulo.tipo_articulo === 'equipo' && articulo.cantidad ? ` [x${articulo.cantidad}]` : '';
    return `${name}${serie}${talla}${cant}${ubicacion}`;
  };

  const handleCreateMovimiento = async (e) => {
    e.preventDefault();
    if (!movimientoForm.tipo_movimiento) { showMessage('error', 'Selecciona un tipo de movimiento'); return; }
    if (movimientoForm.items.some(item => !item.articulo_id)) {
      showMessage('error', 'Selecciona los artículos del movimiento'); return;
    }
    if (!movimientoForm.ubicacion_destino_nombre.trim()) {
      showMessage('error', 'Ingresa la ubicación destino'); return;
    }

    const payload = {
      ubicacion_destino_nombre: movimientoForm.ubicacion_destino_nombre,
      items: movimientoForm.items.map(item => ({
        articulo_id: parseInt(item.articulo_id, 10),
        cantidad: item.cantidad ? parseInt(item.cantidad, 10) : 1,
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
  };

  const handleViewMovimientoDetalles = async (movimiento) => {
    setSelectedMovimiento(movimiento);
    const result = await inventarioService.getMovimientoDetalles(movimiento.id);
    if (result.success) {
      setMovimientoDetalles(result.data);
      setShowMovimientoDetalleModal(true);
    } else {
      showMessage('error', result.message);
    }
  };

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

  const handleExport = async () => {
    const params = {};
    if (exportFilters.tipo) params.tipo = exportFilters.tipo;
    if (exportFilters.ubicacion_id) params.ubicacion_id = exportFilters.ubicacion_id;
    if (exportFilters.estado) params.estado = exportFilters.estado;

    const result = await inventarioService.exportArticulosExcel(params);
    if (!result.success) {
      showMessage('error', result.message);
    }
    setShowExportModal(false);
  };

  // ── Helpers ──────────────────────────────────────
  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'vencida': return 'Vencida';
      case 'proxima_a_vencer': return 'Próxima a vencer';
      case 'vigente': return 'Vigente';
      default: return 'Sin alerta';
    }
  };

  const getTipoLabel = (tipo) => {
    const found = INVENTARIO_TIPOS.find(item => item.value === tipo);
    return found ? found.label : tipo;
  };

  const emptyStateText = useMemo(() => {
    if (filters.tipo || filters.ubicacion_id || filters.estado || filters.search) {
      return 'No hay artículos que coincidan con los filtros.';
    }
    return 'No hay artículos registrados en inventario.';
  }, [filters]);

  const closeOverlay = (e, closeFn) => {
    if (e.target === e.currentTarget) closeFn();
  };

  // ── Render ───────────────────────────────────────
  return (
    <div className="inventario-container">
      {/* ── Header ── */}
      <header className="inventario-header">
        <div className="inventario-header-left">
          <button className="btn-back" onClick={() => navigate('/')}>← Volver</button>
          <div>
            <h1>Inventario</h1>
          </div>
        </div>
        <div className="inventario-header-actions">
          {activeTab === 'articulos' && hasPermission('crear_articulo') && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>Crear artículo</button>
          )}
          {activeTab === 'articulos' && hasPermission('exportar') && (
            <button className="btn btn-success" onClick={openExportModal}>Generar reporte</button>
          )}
          {activeTab === 'movimientos' && hasPermission('crear_movimiento') && (
            <button className="btn btn-primary" onClick={openMovimientoModal}>Crear movimiento</button>
          )}
        </div>
      </header>

      {/* ── Toast Message ── */}
      {message.text && (
        <div className={`message message-${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>×</button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="inventario-tabs">
        <button
          className={`tab ${activeTab === 'articulos' ? 'active' : ''}`}
          onClick={() => setActiveTab('articulos')}
        >
          Artículos ({articulos.length})
        </button>
        <button
          className={`tab ${activeTab === 'movimientos' ? 'active' : ''}`}
          onClick={() => setActiveTab('movimientos')}
        >
          Movimientos ({movimientos.length})
        </button>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/*  TAB: ARTÍCULOS                              */}
      {/* ════════════════════════════════════════════ */}
      {activeTab === 'articulos' && (
        <div className="tab-content">
          {/* Filters */}
          <div className="inventario-filters">
            <div className="filter-field">
              <label>Buscar</label>
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nombre, serie, marca o modelo..."
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              />
            </div>
            <div className="filter-field">
              <label>Tipo</label>
              <select name="tipo" value={filters.tipo} onChange={handleFilterChange}>
                {INVENTARIO_TIPOS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label>Ubicación</label>
              <select name="ubicacion_id" value={filters.ubicacion_id} onChange={handleFilterChange}>
                <option value="">Todas las ubicaciones</option>
                {ubicaciones.map(ub => (
                  <option key={ub.id} value={ub.id}>{ub.nombre}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label>Estado</label>
              <select name="estado" value={filters.estado} onChange={handleFilterChange}>
                {INVENTARIO_ESTADOS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-actions">
              <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>Aplicar</button>
              <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>Limpiar</button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              Cargando artículos...
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Artículo</th>
                    <th>Serie</th>
                    <th>Cantidad</th>
                    <th>Talla</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Calibre</th>
                    <th>Caducidad</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    {hasPermission('eliminar_articulo') && <th className="col-actions">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {articulos.length > 0 ? (
                    articulos.map((articulo, idx) => (
                      <tr key={articulo.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td><span className={`tipo-badge tipo-${articulo.tipo_articulo}`}>{getTipoLabel(articulo.tipo_articulo)}</span></td>
                        <td className="cell-articulo">{articulo.nombre_articulo || '-'}</td>
                        <td className="cell-serie">{articulo.numero_serie || '-'}</td>
                        <td className="cell-cantidad">{articulo.cantidad ?? '-'}</td>
                        <td>{articulo.talla || '-'}</td>
                        <td>{articulo.marca || '-'}</td>
                        <td>{articulo.modelo || '-'}</td>
                        <td>{articulo.calibre || '-'}</td>
                        <td>{formatDate(articulo.fecha_caducidad)}</td>
                        <td><span className="ubicacion-tag">{articulo.ubicacion_nombre || '-'}</span></td>
                        <td>
                          <span className={`estado-badge estado-${articulo.estado_caducidad || 'sin_alerta'}`}>
                            {getEstadoLabel(articulo.estado_caducidad)}
                          </span>
                        </td>
                        {hasPermission('eliminar_articulo') && (
                          <td className="col-actions">
                            <div className="action-buttons">
                              <button
                                className="action-btn action-btn-del"
                                onClick={() => handleDeleteArticulo(articulo)}
                                title="Eliminar artículo"
                                type="button"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={hasPermission('eliminar_articulo') ? 12 : 11} className="text-center">
                        {emptyStateText}
                      </td>
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
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Artículos</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Usuario</th>
                    <th className="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length > 0 ? (
                    movimientos.map((mov, idx) => (
                      <tr key={mov.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td>{formatDate(mov.fecha_movimiento)}</td>
                        <td>{mov.items}</td>
                        <td>{mov.ubicacion_origen || '-'}</td>
                        <td>{mov.ubicacion_destino || '-'}</td>
                        <td>{mov.usuario || '-'}</td>
                        <td className="col-actions">
                          <div className="action-buttons">
                            <button
                              className="action-btn action-btn-view"
                              type="button"
                              title="Ver detalles"
                              onClick={() => handleViewMovimientoDetalles(mov)}
                            >
                              Ver
                            </button>
                            <button
                              className="action-btn action-btn-pdf"
                              type="button"
                              title="Descargar PDF"
                              onClick={() => handleDownloadPdf(mov)}
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center">No hay movimientos registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
              <h3>Nuevo Artículo</h3>
              <button className="modal-close" onClick={() => setShowArticuloModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveArticulo}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select name="tipo_articulo" value={formData.tipo_articulo} onChange={handleTipoChange} required>
                      {INVENTARIO_TIPOS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Nombre del Artículo *</label>
                    <input type="text" name="nombre_articulo" value={formData.nombre_articulo} onChange={handleFormChange} placeholder="Ej: Chaleco antibalas" required />
                  </div>

                  {formData.tipo_articulo === 'equipo' && (
                    <>
                      <div className="form-group">
                        <label>Cantidad *</label>
                        <input type="number" name="cantidad" value={formData.cantidad} onChange={handleFormChange} min="1" placeholder="1" required />
                      </div>
                      <div className="form-group">
                        <label>Talla</label>
                        <input type="text" name="talla" value={formData.talla} onChange={handleFormChange} placeholder="S, M, L, XL..." />
                      </div>
                    </>
                  )}

                  {formData.tipo_articulo === 'placa_balistica' && (
                    <>
                      <div className="form-group">
                        <label>Número de Serie</label>
                        <input type="text" name="numero_serie" value={formData.numero_serie} onChange={handleFormChange} placeholder="Ej: PB-001" />
                      </div>
                      <div className="form-group">
                        <label>Fecha de Caducidad</label>
                        <input type="date" name="fecha_caducidad" value={formData.fecha_caducidad} onChange={handleFormChange} />
                      </div>
                    </>
                  )}

                  {formData.tipo_articulo === 'arma' && (
                    <>
                      <div className="form-group">
                        <label>Marca</label>
                        <input type="text" name="marca" value={formData.marca} onChange={handleFormChange} placeholder="Ej: Glock" />
                      </div>
                      <div className="form-group">
                        <label>Modelo</label>
                        <input type="text" name="modelo" value={formData.modelo} onChange={handleFormChange} placeholder="Ej: G19" />
                      </div>
                      <div className="form-group">
                        <label>Número de Serie</label>
                        <input type="text" name="numero_serie" value={formData.numero_serie} onChange={handleFormChange} placeholder="Ej: ABC123" />
                      </div>
                      <div className="form-group">
                        <label>Calibre</label>
                        <input type="text" name="calibre" value={formData.calibre} onChange={handleFormChange} placeholder="Ej: 9mm" />
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label>Ubicación *</label>
                    <input type="text" name="ubicacion_nombre" value={formData.ubicacion_nombre} onChange={handleFormChange} placeholder="Ej: Bodega principal" required />
                  </div>
                </div>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-secondary" type="button" onClick={() => setShowArticuloModal(false)}>Cancelar</button>
                <button className="btn btn-primary" type="submit">Crear Artículo</button>
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
              <h3>Nuevo Movimiento</h3>
              <button className="modal-close" onClick={() => setShowMovimientoModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateMovimiento}>
              <div className="modal-body">
                {/* Items list */}
                <div className="movimiento-items-section">
                  <div className="movimiento-items-header">
                    <h4>Artículos a mover</h4>
                    <button className="btn btn-sm btn-primary" type="button" onClick={handleAddMovimientoItem}>+ Agregar</button>
                  </div>
                  {movimientoForm.items.map((item, index) => {
                    const selectedArticulo = catalogArticulos.find(a => String(a.id) === String(item.articulo_id));
                    const isEquipo = selectedArticulo && selectedArticulo.tipo_articulo === 'equipo';
                    const disableCantidad = selectedArticulo && !isEquipo;
                    const hasSize = Boolean(selectedArticulo?.talla);
                    const maxCantidad = isEquipo && selectedArticulo?.cantidad ? selectedArticulo.cantidad : 1;
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
                                    {a.numero_serie && <span className="dropdown-serie">{a.numero_serie}</span>}
                                    {a.talla && <span className="dropdown-talla">Talla: {a.talla}</span>}
                                    {a.tipo_articulo === 'equipo' && a.cantidad && <span className="dropdown-qty">x{a.cantidad}</span>}
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
                              const val = parseInt(e.target.value, 10) || 1;
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
                </div>

                {/* Destination */}
                <div className="form-group">
                  <label>Ubicación Destino *</label>
                  <input
                    type="text"
                    name="ubicacion_destino_nombre"
                    value={movimientoForm.ubicacion_destino_nombre}
                    onChange={handleMovimientoFormChange}
                    placeholder="Ej: Puesto Norte"
                    required
                  />
                </div>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-secondary" type="button" onClick={() => setShowMovimientoModal(false)}>Cancelar</button>
                <button className="btn btn-primary" type="submit">Guardar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: DETALLE MOVIMIENTO                   */}
      {/* ════════════════════════════════════════════ */}
      {showMovimientoDetalleModal && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowMovimientoDetalleModal(false))}>
          <div className="modal modal-detalle">
            <div className="modal-header">
              <h3>Detalle — Movimiento #{selectedMovimiento?.id}</h3>
              <button className="modal-close" onClick={() => setShowMovimientoDetalleModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Movement info summary */}
              {selectedMovimiento && (
                <div className="detalle-info">
                  <div className="detalle-info-item">
                    <span className="detalle-label">Fecha</span>
                    <span className="detalle-value">{formatDate(selectedMovimiento.fecha_movimiento)}</span>
                  </div>
                  <div className="detalle-info-item">
                    <span className="detalle-label">Origen</span>
                    <span className="detalle-value">{selectedMovimiento.ubicacion_origen || '-'}</span>
                  </div>
                  <div className="detalle-info-item">
                    <span className="detalle-label">Destino</span>
                    <span className="detalle-value">{selectedMovimiento.ubicacion_destino || '-'}</span>
                  </div>
                  <div className="detalle-info-item">
                    <span className="detalle-label">Registrado por</span>
                    <span className="detalle-value">{selectedMovimiento.usuario || '-'}</span>
                  </div>
                </div>
              )}

              {/* Items table */}
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Tipo</th>
                      <th>Serie</th>
                      <th>Cantidad</th>
                      <th>Origen</th>
                      <th>Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientoDetalles.length > 0 ? (
                      movimientoDetalles.map((detalle, idx) => (
                        <tr key={detalle.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                          <td className="cell-articulo">
                            {detalle.nombre_articulo || detalle.numero_serie || 'Artículo'}
                            {detalle.activo === false && <span className="deleted-badge">Eliminado</span>}
                          </td>
                          <td><span className={`tipo-badge tipo-${detalle.tipo_articulo}`}>{getTipoLabel(detalle.tipo_articulo)}</span></td>
                          <td className="cell-serie">{detalle.numero_serie || '-'}</td>
                          <td className="cell-cantidad">{detalle.cantidad || 1}</td>
                          <td>{detalle.ubicacion_origen || '-'}</td>
                          <td>{detalle.ubicacion_destino || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center">Sin detalles</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
              <h3>Exportar inventario</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={exportFilters.tipo}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, tipo: e.target.value }))}
                  >
                    {INVENTARIO_TIPOS.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ubicación</label>
                  <select
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
                  <label>Estado</label>
                  <select
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
            <div className="modal-buttons">
              <button className="btn btn-success" onClick={handleExport}>Descargar reporte</button>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  MODAL: ELIMINAR CANTIDAD (equipos)          */}
      {/* ════════════════════════════════════════════ */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={(e) => closeOverlay(e, () => setShowDeleteModal(false))}>
          <div className="modal modal-delete">
            <div className="modal-header">
              <h3>Eliminar Cantidad</h3>
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
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
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
              <h3>Confirmar Eliminación</h3>
              <button className="modal-close" onClick={() => setShowConfirmDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="delete-context">
                ¿Estás seguro de eliminar <strong>{deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}</strong>?
              </p>
              <p className="delete-warning">Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => setShowConfirmDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleConfirmSimpleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
