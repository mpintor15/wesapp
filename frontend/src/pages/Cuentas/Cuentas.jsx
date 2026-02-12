import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import cuentasService from '../../services/cuentasService';
import useSubmitState from '../../hooks/useSubmitState';
import Clientes from './Clientes';
import './Cuentas.css';

const formatMoney = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-EC');
};

const Cuentas = () => {
  const navigate = useNavigate();

  // Submit state management (prevent double-submit)
  const { isSubmitting: isCreatingFactura, withSubmit: withFacturaSubmit } = useSubmitState();
  const { isSubmitting: isAddingPayment, withSubmit: withPaymentSubmit } = useSubmitState();

  // Data state
  const [clientes, setClientes] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('facturas');

  // Messages
  const [message, setMessage] = useState({ type: '', text: '' });

  // Nueva factura modal
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [formData, setFormData] = useState({
    num_factura: '',
    cliente_id: '',
    fecha_factura: '',
    valor_factura: '',
    incluye_iva: false,
    incluye_retencion_fuente: false,
    incluye_retencion_iva: false
  });

  // Cliente search
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  // Expanded rows (detail view)
  const [expandedRows, setExpandedRows] = useState({});
  const [abonosData, setAbonosData] = useState({});

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Report modal
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
    soloDeudores: false
  });

  // Facturas table filters
  const [facturaFilters, setFacturaFilters] = useState({
    search: '',
    fechaInicio: '',
    fechaFin: '',
    conSaldo: false
  });
  const [facturaFiltersDraft, setFacturaFiltersDraft] = useState({
    search: '',
    fechaInicio: '',
    fechaFin: '',
    conSaldo: false
  });

  // Clientes form
  const [showClienteForm, setShowClienteForm] = useState(false);

  // Auto-dismiss messages after 4 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Close cliente dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showClienteDropdown && !e.target.closest('.cliente-search-container')) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClienteDropdown]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [clientesRes, reporteRes] = await Promise.all([
      cuentasService.getClientes(),
      cuentasService.getReporte()
    ]);

    if (clientesRes.success) setClientes(clientesRes.data);
    if (reporteRes.success) setReporte(reporteRes.data);
    setLoading(false);
  };

  const refreshRowDetails = useCallback(async (num_factura) => {
    const abonosRes = await cuentasService.getAbonosByFactura(num_factura);

    if (abonosRes.success) {
      setAbonosData(prev => ({ ...prev, [num_factura]: abonosRes.data || [] }));
    }
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleClienteSelect = (cliente) => {
    setFormData(prev => ({ ...prev, cliente_id: cliente.id }));
    setClienteSearch(cliente.nombre);
    setShowClienteDropdown(false);
  };

  const handleClienteSearchChange = (e) => {
    const value = e.target.value;
    setClienteSearch(value);
    setShowClienteDropdown(true);
    if (!value) {
      setFormData(prev => ({ ...prev, cliente_id: '' }));
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.identificacion.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const handleCreateFactura = withFacturaSubmit(async (e) => {
    e.preventDefault();
    if (!formData.num_factura || !formData.cliente_id || !formData.fecha_factura || !formData.valor_factura) {
      setMessage({ type: 'error', text: 'Todos los campos son requeridos' });
      return;
    }

    const result = await cuentasService.createFactura({
      num_factura: parseInt(formData.num_factura),
      cliente_id: parseInt(formData.cliente_id),
      fecha_factura: formData.fecha_factura,
      valor_factura: parseFloat(formData.valor_factura),
      incluye_iva: formData.incluye_iva,
      incluye_retencion_fuente: formData.incluye_retencion_fuente,
      incluye_retencion_iva: formData.incluye_retencion_iva
    });

    if (result.success) {
      setMessage({ type: 'success', text: 'Factura creada exitosamente' });
      setFormData({
        num_factura: '',
        cliente_id: '',
        fecha_factura: '',
        valor_factura: '',
        incluye_iva: false,
        incluye_retencion_fuente: false,
        incluye_retencion_iva: false
      });
      setClienteSearch('');
      setShowFacturaModal(false);
      loadData();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  });

  const handleDeleteFactura = async (num_factura) => {
    if (window.confirm(`¿Eliminar factura #${num_factura}? Se borrarán sus retenciones y abonos.`)) {
      const result = await cuentasService.deleteFactura(num_factura);
      if (result.success) {
        setMessage({ type: 'success', text: 'Factura eliminada' });
        loadData();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    }
  };

  const handleCancelFactura = async (num_factura) => {
    if (window.confirm(`¿Anular factura #${num_factura}? Esta acción no se puede revertir. La factura quedará en el historial pero no contará en los totales.`)) {
      const result = await cuentasService.cancelFactura(num_factura);
      if (result.success) {
        setMessage({ type: 'success', text: 'Factura anulada exitosamente' });
        loadData();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    }
  };

  const toggleRowExpand = async (num_factura) => {
    const isExpanding = !expandedRows[num_factura];
    setExpandedRows(prev => ({ ...prev, [num_factura]: isExpanding }));

    if (isExpanding) {
      await refreshRowDetails(num_factura);
    }
  };

  const handleAddPayment = withPaymentSubmit(async (e) => {
    e.preventDefault();
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setMessage({ type: 'error', text: 'Ingresa un monto válido' });
      return;
    }

    // Validación adicional: verificar que el pago no exceda el saldo pendiente
    const payment = parseFloat(paymentAmount);
    const saldo = parseFloat(selectedFactura.saldo_pendiente);

    if (payment > saldo) {
      const confirm = window.confirm(
        `El pago de ${formatMoney(payment)} excede el saldo pendiente de ${formatMoney(saldo)}.\n\n` +
        `Esto generará un saldo a favor del cliente de ${formatMoney(payment - saldo)}.\n\n` +
        `¿Deseas continuar?`
      );
      if (!confirm) return;
    }

    const result = await cuentasService.createAbono({
      num_factura: selectedFactura.num_factura,
      fecha_abono: paymentDate,
      valor_abono: payment
    });

    if (result.success) {
      setMessage({ type: 'success', text: 'Pago registrado exitosamente' });
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setShowPaymentModal(false);
      await loadData();
      if (expandedRows[selectedFactura.num_factura]) {
        await refreshRowDetails(selectedFactura.num_factura);
      }
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  });


  // ============================================
  // REPORT FILTERING
  // ============================================

  const toReportDate = (dateValue) => {
    if (!dateValue) return null;
    return new Date(`${dateValue}T00:00:00`);
  };

  const filteredReporte = reporte.filter((row) => {
    const rowDate = toReportDate(row.fecha_factura);
    const startDate = toReportDate(reportFilters.fechaInicio);
    const endDate = toReportDate(reportFilters.fechaFin);

    if (startDate && rowDate && rowDate < startDate) return false;
    if (endDate && rowDate && rowDate > endDate) return false;
    if (reportFilters.soloDeudores && parseFloat(row.saldo_pendiente) <= 0) return false;
    return true;
  });

  // ============================================
  // FACTURAS TABLE FILTERING
  // ============================================

  const filteredFacturas = reporte.filter((row) => {
    const rowDate = toReportDate(row.fecha_factura);
    const startDate = toReportDate(facturaFilters.fechaInicio);
    const endDate = toReportDate(facturaFilters.fechaFin);

    if (startDate && rowDate && rowDate < startDate) return false;
    if (endDate && rowDate && rowDate > endDate) return false;
    if (facturaFilters.conSaldo && parseFloat(row.saldo_pendiente) <= 0) return false;

    if (facturaFilters.search) {
      const search = facturaFilters.search.trim().toLowerCase();
      const matchFactura = String(row.num_factura || '').toLowerCase().includes(search);
      const matchCliente = String(row.cliente || '').toLowerCase().includes(search);
      if (!matchFactura && !matchCliente) return false;
    }

    return true;
  });

  const handleFacturaFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFacturaFiltersDraft(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const applyFacturaFilters = () => {
    setFacturaFilters(facturaFiltersDraft);
  };

  const clearFacturaFilters = () => {
    const cleared = { search: '', fechaInicio: '', fechaFin: '', conSaldo: false };
    setFacturaFiltersDraft(cleared);
    setFacturaFilters(cleared);
  };

  const handleReportFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setReportFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleExportExcel = async () => {
    const params = {};
    if (reportFilters.fechaInicio) params.fecha_inicio = reportFilters.fechaInicio;
    if (reportFilters.fechaFin) params.fecha_fin = reportFilters.fechaFin;
    if (reportFilters.soloDeudores) params.solo_deudores = true;

    const result = await cuentasService.exportExcel(params);
    if (result.success) {
      setMessage({ type: 'success', text: 'Reporte exportado exitosamente' });
    } else {
      setMessage({ type: 'error', text: result.message || 'Error al exportar' });
    }
  };

  // ============================================
  // SUMMARY TOTALS
  // ============================================

  const totals = filteredFacturas
    .filter(row => !row.cancelada)
    .reduce((acc, row) => ({
      subtotal: acc.subtotal + parseFloat(row.subtotal || 0),
      iva: acc.iva + parseFloat(row.iva || 0),
      retencion_fuente: acc.retencion_fuente + parseFloat(row.retencion_fuente || 0),
      retencion_iva: acc.retencion_iva + parseFloat(row.retencion_iva || 0),
      por_cobrar: acc.por_cobrar + parseFloat(row.por_cobrar || 0),
      total_abonos: acc.total_abonos + parseFloat(row.total_abonos || 0),
      saldo_pendiente: acc.saldo_pendiente + parseFloat(row.saldo_pendiente || 0)
    }), { subtotal: 0, iva: 0, retencion_fuente: 0, retencion_iva: 0, por_cobrar: 0, total_abonos: 0, saldo_pendiente: 0 });

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="cuentas-container">
      {/* Header with back navigation */}
      <header className="cuentas-header">
        <div className="cuentas-header-left">
          <button className="btn-back" onClick={() => navigate('/')} title="Volver al Dashboard">
            ← Volver
          </button>
          <div>
            <h1>Control de Cuentas</h1>
          </div>
        </div>
        {activeTab === 'facturas' && (
          <div className="cuentas-header-actions">
            <button className="btn btn-primary" onClick={() => setShowFacturaModal(true)}>
              Crear factura
            </button>
            <button className="btn btn-success" onClick={() => setShowReporteModal(true)}>
              Generar reporte
            </button>
          </div>
        )}
        {activeTab === 'clientes' && (
          <div className="cuentas-header-actions">
            <button className="btn btn-primary" onClick={() => setShowClienteForm(!showClienteForm)}>
              {showClienteForm ? 'Cancelar' : 'Crear cliente'}
            </button>
          </div>
        )}
      </header>

      {/* Toast messages */}
      {message.text && (
        <div className={`message message-${message.type}`}>
          <span>{message.type === 'success' ? '✓' : '!'} {message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>×</button>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span>Cargando datos...</span>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="cuentas-tabs">
            <button
              className={`tab ${activeTab === 'facturas' ? 'active' : ''}`}
              onClick={() => setActiveTab('facturas')}
            >
              Facturas ({reporte.length})
            </button>
            <button
              className={`tab ${activeTab === 'clientes' ? 'active' : ''}`}
              onClick={() => setActiveTab('clientes')}
            >
              Clientes ({clientes.length})
            </button>
          </div>

          {/* FACTURAS TAB */}
          {activeTab === 'facturas' && (
            <div className="tab-content">
              <div className="facturas-filters">
                <div className="filter-group">
                  <label>Buscar</label>
                  <input
                    type="text"
                    name="search"
                    value={facturaFiltersDraft.search}
                    onChange={handleFacturaFilterChange}
                    placeholder="N° factura o cliente"
                  />
                </div>
                <div className="filter-group">
                  <label>Desde</label>
                  <input
                    type="date"
                    name="fechaInicio"
                    value={facturaFiltersDraft.fechaInicio}
                    onChange={handleFacturaFilterChange}
                  />
                </div>
                <div className="filter-group">
                  <label>Hasta</label>
                  <input
                    type="date"
                    name="fechaFin"
                    value={facturaFiltersDraft.fechaFin}
                    onChange={handleFacturaFilterChange}
                  />
                </div>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    name="conSaldo"
                    checked={facturaFiltersDraft.conSaldo}
                    onChange={handleFacturaFilterChange}
                  />
                  Solo con saldo pendiente
                </label>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={applyFacturaFilters}
                >
                  Aplicar
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={clearFacturaFilters}
                >
                  Limpiar
                </button>
              </div>


              {/* Main Data Table */}
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-expand"></th>
                      <th>N° Factura</th>
                      <th>Cliente</th>
                      <th>Identificación</th>
                      <th>Fecha</th>
                      <th className="col-money">Subtotal</th>
                      <th className="col-money">IVA</th>
                      <th className="col-money">Ret. Fuente</th>
                      <th className="col-money">Ret. IVA</th>
                      <th className="col-money">Por Cobrar</th>
                      <th className="col-money">Abonos</th>
                      <th className="col-money">Saldo Pendiente</th>
                      <th className="col-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFacturas.length > 0 ? (
                      filteredFacturas.map((row, idx) => (
                        <React.Fragment key={row.num_factura}>
                          <tr className={`${idx % 2 === 0 ? 'row-even' : 'row-odd'} ${row.cancelada ? 'row-canceled' : ''}`}>
                            <td>
                              <button
                                className="expand-btn"
                                onClick={() => toggleRowExpand(row.num_factura)}
                                title="Ver detalle"
                              >
                                {expandedRows[row.num_factura] ? '▼' : '▶'}
                              </button>
                            </td>
                            <td className="cell-factura">
                              {row.num_factura}
                              {row.cancelada && <span className="badge-cancelada">ANULADA</span>}
                            </td>
                            <td>{row.cliente}</td>
                            <td>{row.identificacion || '-'}</td>
                            <td>{formatDate(row.fecha_factura)}</td>
                            <td className="col-money">{formatMoney(row.subtotal)}</td>
                            <td className="col-money">{formatMoney(row.iva)}</td>
                            <td className="col-money">{formatMoney(row.retencion_fuente)}</td>
                            <td className="col-money">{formatMoney(row.retencion_iva)}</td>
                            <td className="col-money">{formatMoney(row.por_cobrar)}</td>
                            <td className="col-money">{formatMoney(row.total_abonos)}</td>
                            <td className={`col-money ${parseFloat(row.saldo_pendiente) > 0 ? 'text-danger' : 'text-success'}`}>
                              {formatMoney(row.saldo_pendiente)}
                            </td>
                            <td>
                              <div className="action-buttons">
                                {!row.cancelada && (
                                  <>
                                    <button
                                      className="action-btn action-btn-pay"
                                      onClick={() => { setSelectedFactura(row); setShowPaymentModal(true); }}
                                      title="Agregar Pago"
                                      type="button"
                                    >
                                      <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                    <button
                                      className="action-btn action-btn-cancel"
                                      onClick={() => handleCancelFactura(row.num_factura)}
                                      title="Anular Factura"
                                      type="button"
                                    >
                                      <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                                <button
                                  className="action-btn action-btn-del"
                                  onClick={() => handleDeleteFactura(row.num_factura)}
                                  title="Eliminar Factura"
                                  type="button"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M6 7h12M9 7v10m6-10v10M9 7h6M10 4h4l1 2H9l1-2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Detail Row */}
                          {expandedRows[row.num_factura] && (
                            <tr className="expanded-row">
                              <td colSpan="13">
                                <div className="history-container history-container-single">
                                  <div className="history-section">
                                    <h4>Historial de Pagos (Abonos)</h4>
                                    {abonosData[row.num_factura]?.length > 0 ? (
                                      <table className="history-table">
                                        <thead>
                                          <tr>
                                            <th>Fecha</th>
                                            <th>Monto</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {abonosData[row.num_factura].map((abono, i) => (
                                            <tr key={i}>
                                              <td>{formatDate(abono.fecha_abono)}</td>
                                              <td>{formatMoney(abono.valor_abono)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p className="no-data">Sin pagos registrados</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="13" className="text-center">
                          {facturaFilters.search || facturaFilters.fechaInicio || facturaFilters.fechaFin || facturaFilters.conSaldo
                            ? 'No hay facturas para los filtros seleccionados'
                            : 'No hay facturas registradas'}
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Summary Totals Footer */}
                  {filteredFacturas.length > 0 && (
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan="5" className="totals-label">TOTALES</td>
                        <td className="col-money">{formatMoney(totals.subtotal)}</td>
                        <td className="col-money">{formatMoney(totals.iva)}</td>
                        <td className="col-money">{formatMoney(totals.retencion_fuente)}</td>
                        <td className="col-money">{formatMoney(totals.retencion_iva)}</td>
                        <td className="col-money">{formatMoney(totals.por_cobrar)}</td>
                        <td className="col-money">{formatMoney(totals.total_abonos)}</td>
                        <td className={`col-money ${totals.saldo_pendiente > 0 ? 'text-danger' : 'text-success'}`}>
                          {formatMoney(totals.saldo_pendiente)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* CLIENTES TAB */}
          {activeTab === 'clientes' && (
            <div className="tab-content">
              <Clientes
                clientes={clientes}
                onClienteCreated={loadData}
                onClienteDeleted={loadData}
                message={message}
                setMessage={setMessage}
                showClienteForm={showClienteForm}
                setShowClienteForm={setShowClienteForm}
              />
            </div>
          )}

          {/* ============================================ */}
          {/* CREAR FACTURA MODAL */}
          {/* ============================================ */}
          {showFacturaModal && (
            <div className="modal-overlay" onClick={() => setShowFacturaModal(false)}>
              <div className="modal modal-factura" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Crear Nueva Factura</h3>
                  <button className="modal-close" onClick={() => setShowFacturaModal(false)}>×</button>
                </div>
                <form onSubmit={handleCreateFactura}>
                  <div className="modal-form-grid">
                    <div className="form-group">
                      <label>N° Factura</label>
                      <input
                        type="number"
                        name="num_factura"
                        value={formData.num_factura}
                        onChange={handleFormChange}
                        placeholder="Ej: 1006"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="form-group cliente-search-group">
                      <label>Cliente</label>
                      <div className="cliente-search-container">
                        <input
                          type="text"
                          value={clienteSearch}
                          onChange={handleClienteSearchChange}
                          onFocus={() => setShowClienteDropdown(true)}
                          placeholder="Buscar cliente..."
                          autoComplete="off"
                          required={!formData.cliente_id}
                        />
                        {showClienteDropdown && clienteSearch && (
                          <div className="cliente-dropdown">
                            {filteredClientes.length > 0 ? (
                              filteredClientes.map(c => (
                                <div
                                  key={c.id}
                                  className="cliente-option"
                                  onClick={() => handleClienteSelect(c)}
                                >
                                  <div className="cliente-nombre">{c.nombre}</div>
                                  <div className="cliente-identificacion">{c.identificacion}</div>
                                </div>
                              ))
                            ) : (
                              <div className="cliente-option-empty">
                                No se encontraron clientes
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Fecha</label>
                      <input
                        type="date"
                        name="fecha_factura"
                        value={formData.fecha_factura}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Subtotal</label>
                      <input
                        type="number"
                        name="valor_factura"
                        step="0.01"
                        min="0.01"
                        value={formData.valor_factura}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div className="modal-checkboxes-section">
                    <label className="section-label">Retenciones e IVA</label>
                    <div className="modal-checkboxes">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="incluye_iva"
                          checked={formData.incluye_iva}
                          onChange={handleFormChange}
                        />
                        Incluye IVA (15%)
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="incluye_retencion_fuente"
                          checked={formData.incluye_retencion_fuente}
                          onChange={handleFormChange}
                        />
                        Retención de fuente (2.75%)
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="incluye_retencion_iva"
                          checked={formData.incluye_retencion_iva}
                          onChange={handleFormChange}
                          disabled={!formData.incluye_iva}
                        />
                        Retención de IVA (70% del IVA)
                      </label>
                    </div>
                  </div>

                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-success" disabled={isCreatingFactura}>
                      {isCreatingFactura ? 'Creando...' : 'Crear Factura'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowFacturaModal(false)} disabled={isCreatingFactura}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* PAYMENT MODAL */}
          {/* ============================================ */}
          {showPaymentModal && selectedFactura && (
            <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Agregar Pago</h3>
                  <button className="modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
                </div>
                <div className="modal-context">
                  <span>Factura <strong>#{selectedFactura.num_factura}</strong></span>
                  <span>{selectedFactura.cliente}</span>
                  <span className="modal-context-balance">
                    Saldo: <strong className={parseFloat(selectedFactura.saldo_pendiente) > 0 ? 'text-danger' : 'text-success'}>
                      {formatMoney(selectedFactura.saldo_pendiente)}
                    </strong>
                  </span>
                </div>
                <form onSubmit={handleAddPayment}>
                  <div className="form-group">
                    <label>Fecha del Pago</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Monto del Pago</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-success" disabled={isAddingPayment}>
                      {isAddingPayment ? 'Guardando...' : 'Guardar Pago'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)} disabled={isAddingPayment}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* REPORT MODAL */}
          {/* ============================================ */}
          {showReporteModal && (
            <div className="modal-overlay" onClick={() => setShowReporteModal(false)}>
              <div className="modal report-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Reporte de Control de Cuentas</h3>
                  <button className="modal-close" onClick={() => setShowReporteModal(false)}>×</button>
                </div>

                <div className="report-controls">
                  <div className="form-group">
                    <label>Desde</label>
                    <input
                      type="date"
                      name="fechaInicio"
                      value={reportFilters.fechaInicio}
                      onChange={handleReportFilterChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Hasta</label>
                    <input
                      type="date"
                      name="fechaFin"
                      value={reportFilters.fechaFin}
                      onChange={handleReportFilterChange}
                    />
                  </div>
                  <label className="report-checkbox">
                    <input
                      type="checkbox"
                      name="soloDeudores"
                      checked={reportFilters.soloDeudores}
                      onChange={handleReportFilterChange}
                    />
                    Solo con saldo pendiente
                  </label>
                  <div className="report-actions">
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => setReportFilters({ fechaInicio: '', fechaFin: '', soloDeudores: false })}
                    >
                      Limpiar
                    </button>
                    <button className="btn btn-success" onClick={handleExportExcel}>
                      Exportar Excel
                    </button>
                  </div>
                </div>

                <div className="report-summary">
                  <span>{filteredReporte.length} factura{filteredReporte.length !== 1 ? 's' : ''}</span>
                  <span>Saldo total: <strong className={
                    filteredReporte.reduce((s, r) => s + parseFloat(r.saldo_pendiente || 0), 0) > 0 ? 'text-danger' : 'text-success'
                  }>
                    {formatMoney(filteredReporte.reduce((s, r) => s + parseFloat(r.saldo_pendiente || 0), 0))}
                  </strong></span>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>N° Factura</th>
                        <th>Cliente</th>
                        <th>Identificación</th>
                        <th>Fecha</th>
                        <th className="col-money">Subtotal</th>
                        <th className="col-money">IVA</th>
                        <th className="col-money">Ret. Fuente</th>
                        <th className="col-money">Ret. IVA</th>
                        <th className="col-money">Por Cobrar</th>
                        <th className="col-money">Abonos</th>
                        <th className="col-money">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReporte.length > 0 ? (
                        filteredReporte.map((row, idx) => (
                          <tr key={row.num_factura} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                            <td className="cell-factura">{row.num_factura}</td>
                            <td>{row.cliente}</td>
                            <td>{row.identificacion || '-'}</td>
                            <td>{formatDate(row.fecha_factura)}</td>
                            <td className="col-money">{formatMoney(row.subtotal)}</td>
                            <td className="col-money">{formatMoney(row.iva)}</td>
                            <td className="col-money">{formatMoney(row.retencion_fuente)}</td>
                            <td className="col-money">{formatMoney(row.retencion_iva)}</td>
                            <td className="col-money">{formatMoney(row.por_cobrar)}</td>
                            <td className="col-money">{formatMoney(row.total_abonos)}</td>
                            <td className={`col-money ${parseFloat(row.saldo_pendiente) > 0 ? 'text-danger' : 'text-success'}`}>
                              {formatMoney(row.saldo_pendiente)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="11" className="text-center">No hay datos para los filtros seleccionados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Cuentas;
