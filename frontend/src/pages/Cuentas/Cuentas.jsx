import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import cuentasService from '../../services/cuentasService';
import useSubmitState from '../../hooks/useSubmitState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import Clientes from './Clientes';
import './Cuentas.css';

const formatMoney = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const dateOnlyMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-EC');
  }
  return new Date(dateStr).toLocaleDateString('es-EC');
};

const formatMetodoPago = (value) => {
  if (!value) return '-';
  const map = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    cheque: 'Cheque',
    otro: 'Otro'
  };
  return map[String(value).toLowerCase()] || value;
};

const getInitialFacturaForm = () => ({
  num_factura: '',
  cliente_id: '',
  fecha_factura: '',
  valor_factura: '',
  incluye_iva: false,
  incluye_retencion_fuente: false,
  incluye_retencion_iva: false
});

const DEFAULT_FACTURA_FILTERS = {
  search: '',
  fechaInicio: '',
  fechaFin: '',
  conSaldo: true,
  ordenAlfabetico: true,
  estado: ''
};

const ROWS_PER_PAGE = 50;
const PAGOS_ROWS_PER_PAGE = 20;

const DEFAULT_PAGO_FILTERS = {
  search: '',
  fechaInicio: '',
  fechaFin: '',
  metodoPago: '',
  agruparCliente: true
};

const Cuentas = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isGerente = user?.tipo_usuario === 'gerente';

  const { isSubmitting: isCreatingFactura, withSubmit: withFacturaSubmit } = useSubmitState();
  const { isSubmitting: isSubmittingBatchPayment, withSubmit: withBatchPaymentSubmit } = useSubmitState();
  const { isSubmitting: isSubmittingCancelFactura, withSubmit: withCancelFacturaSubmit } = useSubmitState();
  const { isSubmitting: isUpdatingFactura, withSubmit: withUpdateFacturaSubmit } = useSubmitState();
  const { isSubmitting: isExportingReporte, withSubmit: withReporteExportSubmit } = useSubmitState();
  const { isSubmitting: isExportingClientes, withSubmit: withClientesExportSubmit } = useSubmitState();
  const { isSubmitting: isExportingPagos, withSubmit: withPagosExportSubmit } = useSubmitState();

  const [clientes, setClientes] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('facturas');

  // Nueva factura modal
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [formData, setFormData] = useState(getInitialFacturaForm());
  const [facturaErrors, setFacturaErrors] = useState({});
  const [debouncedFacturaInputs, setDebouncedFacturaInputs] = useState({
    num_factura: '',
    valor_factura: ''
  });

  // Cliente search
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);

  // Anulacion detail modal
  const [anulacionModal, setAnulacionModal] = useState(null);

  // Batch payment modal (per customer)
  const [showBatchPaymentModal, setShowBatchPaymentModal] = useState(false);
  const [showCancelFacturaModal, setShowCancelFacturaModal] = useState(false);
  const [selectedPago, setSelectedPago] = useState(null);
  const [pagoToDelete, setPagoToDelete] = useState(null);
  const [facturaToCancel, setFacturaToCancel] = useState(null);
  const [facturaToDelete, setFacturaToDelete] = useState(null);
  const [cancelDetail, setCancelDetail] = useState('');
  const [bpCustomerSearch, setBpCustomerSearch] = useState('');
  const [bpShowDropdown, setBpShowDropdown] = useState(false);
  const [bpCustomer, setBpCustomer] = useState(null);
  const [bpDate, setBpDate] = useState(new Date().toISOString().split('T')[0]);
  const [bpTotalCredit, setBpTotalCredit] = useState('');
  const [bpSelections, setBpSelections] = useState({});
  const [bpMetodoPago, setBpMetodoPago] = useState('efectivo');
  const [bpNotas, setBpNotas] = useState('');
  const [bpErrors, setBpErrors] = useState({});

  const autoDistribute = (total, invoices) => {
    let remaining = Math.round(parseFloat(total) * 100) / 100;
    const newSelections = {};
    for (const inv of invoices) {
      if (remaining <= 0) {
        newSelections[inv.num_factura] = { selected: false, amount: '' };
        continue;
      }
      const saldo = parseFloat(inv.saldo_pendiente);
      const amount = Math.min(remaining, saldo);
      newSelections[inv.num_factura] = { selected: true, amount: amount.toFixed(2) };
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
    return newSelections;
  };

  const handleBpPayFull = (inv) => {
    setBpSelections(prev => ({
      ...prev,
      [inv.num_factura]: { selected: true, amount: String(parseFloat(inv.saldo_pendiente).toFixed(2)) }
    }));
    setBpErrors(prev => ({ ...prev, abonos: '', [`amount_${inv.num_factura}`]: '' }));
  };

  // Report modal (Facturas)
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [showClientesReporteConfirm, setShowClientesReporteConfirm] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
    soloDeudores: false,
    agruparCliente: false
  });

  // Report modal (Pagos)
  const [showPagosReporteModal, setShowPagosReporteModal] = useState(false);
  const [pagosReportFilters, setPagosReportFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
    metodoPago: ''
  });

  // Facturas table filters
  const [facturaFilters, setFacturaFilters] = useState(DEFAULT_FACTURA_FILTERS);
  const [facturaFiltersDraft, setFacturaFiltersDraft] = useState(DEFAULT_FACTURA_FILTERS);
  const [facturaTableSort, setFacturaTableSort] = useState({ field: '', direction: 'asc' });
  const [pagoFilters, setPagoFilters] = useState(DEFAULT_PAGO_FILTERS);
  const [pagoFiltersDraft, setPagoFiltersDraft] = useState(DEFAULT_PAGO_FILTERS);
  const [pagoTableSort, setPagoTableSort] = useState({ field: 'fecha', direction: 'desc' });

  // Clientes form
  const [showClienteForm, setShowClienteForm] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagosCurrentPage, setPagosCurrentPage] = useState(1);

  // Edit factura modal (gerente only)
  const [showEditFacturaModal, setShowEditFacturaModal] = useState(false);
  const [editFacturaData, setEditFacturaData] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editFacturaErrors, setEditFacturaErrors] = useState({});




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

  // Close bp cliente dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bpShowDropdown && !e.target.closest('.bp-cliente-search-container')) {
        setBpShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bpShowDropdown]);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [clientesRes, reporteRes, pagosRes] = await Promise.all([
      cuentasService.getClientes(),
      cuentasService.getReporte(),
      cuentasService.getPagos()
    ]);

    if (clientesRes.success) setClientes(clientesRes.data);
    if (reporteRes.success) setReporte(reporteRes.data);
    if (pagosRes.success) setPagos(pagosRes.data);
    if (!clientesRes.success || !reporteRes.success || !pagosRes.success) {
      const message = clientesRes.message || reporteRes.message || pagosRes.message || 'Error al cargar cuentas';
      setLoadError(message);
      showToast(message, 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showFacturaModal) return;
    setFormData(prev => ({
      ...prev,
      fecha_factura: prev.fecha_factura || new Date().toISOString().split('T')[0]
    }));
  }, [showFacturaModal]);

  useEffect(() => {
    if (!showFacturaModal) return;
    const timeoutId = window.setTimeout(() => {
      setDebouncedFacturaInputs({
        num_factura: formData.num_factura,
        valor_factura: formData.valor_factura
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [showFacturaModal, formData.num_factura, formData.valor_factura]);

  useEffect(() => {
    if (!showBatchPaymentModal) return;
    setBpDate(prev => prev || new Date().toISOString().split('T')[0]);
    setBpErrors({});
  }, [showBatchPaymentModal]);

  // ============================================
  // HANDLERS
  // ============================================

  const openCreateFacturaModal = useCallback(() => {
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede crear facturas', 'error');
      return;
    }
    setFormData(getInitialFacturaForm());
    setDebouncedFacturaInputs({ num_factura: '', valor_factura: '' });
    setShowFacturaModal(true);
  }, [isGerente, showToast]);

  const openEditFacturaModal = useCallback((row) => {
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede editar facturas', 'error');
      return;
    }
    setEditFacturaData(row);
    setEditFormData({
      cliente_id: String(row.cliente_id || ''),
      fecha_factura: row.fecha_factura ? String(row.fecha_factura).split('T')[0] : '',
      valor_factura: String(parseFloat(row.subtotal || 0)),
      incluye_iva: !!row.incluye_iva,
      incluye_retencion_fuente: !!row.incluye_retencion_fuente,
      incluye_retencion_iva: !!row.incluye_retencion_iva
    });
    setEditFacturaErrors({});
    setShowEditFacturaModal(true);
  }, [isGerente, showToast]);

  const closeEditFacturaModal = useCallback(() => {
    setShowEditFacturaModal(false);
    setEditFacturaData(null);
    setEditFormData({});
    setEditFacturaErrors({});
  }, []);

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'incluye_iva' && !checked ? { incluye_retencion_iva: false } : {})
    }));
    setEditFacturaErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleUpdateFactura = withUpdateFacturaSubmit(async (e) => {
    e.preventDefault();
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede editar facturas', 'error');
      return;
    }
    if (!editFacturaData) return;

    const parsedValor = parseFloat(editFormData.valor_factura);
    if (!editFormData.cliente_id || !editFormData.fecha_factura || !editFormData.valor_factura) {
      showToast('Todos los campos son requeridos', 'error');
      return;
    }
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) {
      showToast('El subtotal debe ser mayor a 0', 'error');
      return;
    }

    const result = await cuentasService.updateFactura(editFacturaData.num_factura, {
      cliente_id: parseInt(editFormData.cliente_id),
      fecha_factura: editFormData.fecha_factura,
      valor_factura: parsedValor,
      incluye_iva: editFormData.incluye_iva,
      incluye_retencion_fuente: editFormData.incluye_retencion_fuente,
      incluye_retencion_iva: editFormData.incluye_retencion_iva
    });

    if (result.success) {
      showToast('Factura actualizada exitosamente', 'success');
      closeEditFacturaModal();
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'incluye_iva' && !checked ? { incluye_retencion_iva: false } : {})
    }));
    setFacturaErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleClienteSelect = (cliente) => {
    setFormData(prev => ({ ...prev, cliente_id: cliente.id }));
    setClienteSearch(cliente.nombre);
    setSelectedCliente(cliente);
    setShowClienteDropdown(false);
    setFacturaErrors(prev => ({ ...prev, cliente_id: '' }));
  };

  const handleClienteSearchChange = (e) => {
    const value = e.target.value;
    setClienteSearch(value);
    setShowClienteDropdown(true);
    if (!value || (selectedCliente && value !== selectedCliente.nombre)) {
      setFormData(prev => ({ ...prev, cliente_id: '' }));
      setSelectedCliente(null);
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.identificacion.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const existingInvoiceNumbers = useMemo(() => (
    new Set(
      (reporte || [])
        .map(row => Number(row.num_factura))
        .filter(num => Number.isInteger(num) && num > 0)
    )
  ), [reporte]);

  const debouncedNumFactura = Number(debouncedFacturaInputs.num_factura);
  const isDebouncedNumFacturaDuplicate = Number.isInteger(debouncedNumFactura) && existingInvoiceNumbers.has(debouncedNumFactura);
  const numFacturaError = isDebouncedNumFacturaDuplicate
    ? 'Este N° de factura ya está registrado. Usa uno diferente.'
    : facturaErrors.num_factura;

  const validateFacturaForm = useCallback(() => {
    const errors = {};
    const numFactura = Number(formData.num_factura);
    const valorFactura = Number(formData.valor_factura);
    const fechaFacturaDate = formData.fecha_factura ? new Date(`${formData.fecha_factura}T00:00:00`) : null;

    if (!formData.num_factura) {
      errors.num_factura = 'Ingresa el número de factura';
    } else if (!Number.isInteger(numFactura) || numFactura <= 0) {
      errors.num_factura = 'El N° de factura debe ser un entero mayor a 0';
    } else if (existingInvoiceNumbers.has(numFactura)) {
      errors.num_factura = 'Este N° de factura ya está registrado. Usa uno diferente.';
    }

    if (!formData.cliente_id) {
      errors.cliente_id = 'Selecciona un cliente de la lista';
    }

    if (!formData.fecha_factura) {
      errors.fecha_factura = 'Selecciona la fecha de factura';
    } else if (Number.isNaN(fechaFacturaDate?.getTime())) {
      errors.fecha_factura = 'La fecha ingresada no es válida';
    }

    if (!formData.valor_factura) {
      errors.valor_factura = 'Ingresa el subtotal de la factura';
    } else if (!Number.isFinite(valorFactura) || valorFactura <= 0) {
      errors.valor_factura = 'El subtotal debe ser mayor a 0';
    }

    if (formData.incluye_retencion_iva && !formData.incluye_iva) {
      errors.incluye_retencion_iva = 'La retención de IVA requiere que IVA esté activo';
    }

    return errors;
  }, [existingInvoiceNumbers, formData]);

  const facturaPreview = useMemo(() => {
    const subtotal = Number(formData.valor_factura) || 0;
    const iva = formData.incluye_iva ? subtotal * 0.15 : 0;
    const retencionFuente = formData.incluye_retencion_fuente ? subtotal * 0.03 : 0;
    const retencionIva = formData.incluye_iva && formData.incluye_retencion_iva ? iva * 0.7 : 0;
    const porCobrar = subtotal + iva - retencionFuente - retencionIva;
    return { subtotal, iva, retencionFuente, retencionIva, porCobrar };
  }, [formData.valor_factura, formData.incluye_iva, formData.incluye_retencion_fuente, formData.incluye_retencion_iva]);

  const closeFacturaModal = useCallback(() => {
    setShowFacturaModal(false);
    setFormData(getInitialFacturaForm());
    setFacturaErrors({});
    setDebouncedFacturaInputs({ num_factura: '', valor_factura: '' });
    setClienteSearch('');
    setSelectedCliente(null);
    setShowClienteDropdown(false);
  }, []);

  const flushFacturaNumericInputs = () => {
    setDebouncedFacturaInputs({
      num_factura: formData.num_factura,
      valor_factura: formData.valor_factura
    });
  };

  const shouldShowFacturaCalculation = useMemo(() => (
    parseInt(debouncedFacturaInputs.num_factura, 10) >= 1 &&
    !!formData.cliente_id &&
    /^\d{4}-\d{2}-\d{2}$/.test(formData.fecha_factura) &&
    parseFloat(debouncedFacturaInputs.valor_factura) >= 0.01
  ), [debouncedFacturaInputs.num_factura, debouncedFacturaInputs.valor_factura, formData.cliente_id, formData.fecha_factura]);

  const handleCreateFactura = withFacturaSubmit(async (e) => {
    e.preventDefault();
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede crear facturas', 'error');
      return;
    }
    const errors = validateFacturaForm();
    if (Object.keys(errors).length > 0) {
      setFacturaErrors(errors);
      const firstError = Object.values(errors)[0];
      showToast(firstError, 'error');
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
      showToast('Factura creada exitosamente', 'success');
      closeFacturaModal();
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  });

  const requestDeleteFactura = (row) => {
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede eliminar facturas', 'error');
      return;
    }
    setFacturaToDelete(row);
  };

  const handleDeleteFacturaConfirmed = async () => {
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede eliminar facturas', 'error');
      return;
    }
    if (!facturaToDelete?.num_factura) return;
    const result = await cuentasService.deleteFactura(facturaToDelete.num_factura);
    if (result.success) {
      showToast('Factura eliminada', 'success');
      loadData();
    } else {
      showToast(result.message, 'error');
    }
    setFacturaToDelete(null);
  };

  const openCancelFacturaModal = (row) => {
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede anular facturas', 'error');
      return;
    }
    setFacturaToCancel(row);
    setCancelDetail('');
    setShowCancelFacturaModal(true);
  };

  const closeCancelFacturaModal = () => {
    setShowCancelFacturaModal(false);
    setFacturaToCancel(null);
    setCancelDetail('');
  };

  const openPagoDetailModal = (pago) => {
    setSelectedPago(pago);
  };

  const closePagoDetailModal = () => {
    setSelectedPago(null);
  };

  const handleDeletePagoConfirmed = async () => {
    if (!pagoToDelete?.id) return;
    const result = await cuentasService.deletePago(pagoToDelete.id);
    if (result.success) {
      showToast('Pago eliminado exitosamente', 'success');
      setPagoToDelete(null);
      await loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleCancelFactura = withCancelFacturaSubmit(async (e) => {
    e.preventDefault();
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede anular facturas', 'error');
      return;
    }

    if (!facturaToCancel) return;
    if (!cancelDetail.trim()) {
      showToast('Debes ingresar el detalle de la anulación', 'warning');
      return;
    }

    const result = await cuentasService.cancelFactura(facturaToCancel.num_factura, {
      detalle_anulacion: cancelDetail.trim()
    });

    if (result.success) {
      showToast('Factura anulada exitosamente', 'success');
      closeCancelFacturaModal();
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  });

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-EC', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

// ============================================
  // BATCH PAYMENT HANDLERS
  // ============================================

  const closeBatchPaymentModal = () => {
    setShowBatchPaymentModal(false);
    setBpCustomerSearch('');
    setBpShowDropdown(false);
    setBpCustomer(null);
    setBpTotalCredit('');
    setBpDate(new Date().toISOString().split('T')[0]);
    setBpSelections({});
    setBpMetodoPago('efectivo');
    setBpNotas('');
    setBpErrors({});
  };

  const handleBpCustomerSelect = (cliente) => {
    setBpCustomer(cliente);
    setBpCustomerSearch(cliente.nombre);
    setBpShowDropdown(false);
    setBpErrors(prev => ({ ...prev, cliente: '', abonos: '' }));
    const invoices = reporte
      .filter(r => Number(r.cliente_id) === cliente.id && !r.cancelada && parseFloat(r.saldo_pendiente) > 0)
      .sort((a, b) => {
        const dateDiff = new Date(a.fecha_factura) - new Date(b.fecha_factura);
        if (dateDiff !== 0) return dateDiff;
        return Number(a.num_factura) - Number(b.num_factura);
      });
    if (bpTotalCredit && parseFloat(bpTotalCredit) > 0) {
      setBpSelections(autoDistribute(bpTotalCredit, invoices));
    } else {
      setBpSelections({});
    }
  };

  const handleBpCustomerSearchChange = (e) => {
    const value = e.target.value;
    setBpCustomerSearch(value);
    setBpShowDropdown(true);
    setBpErrors(prev => ({ ...prev, cliente: '' }));
    if (!value || (bpCustomer && value !== bpCustomer.nombre)) {
      setBpCustomer(null);
      setBpSelections({});
    }
  };

  const handleBpTotalCreditChange = (e) => {
    const value = e.target.value;
    setBpTotalCredit(value);
    setBpErrors(prev => ({ ...prev, total: '', abonos: '' }));
    if (bpCustomer && bpInvoices.length > 0 && parseFloat(value) > 0) {
      setBpSelections(autoDistribute(value, bpInvoices));
    } else if (!value) {
      setBpSelections({});
    }
  };

  const handleBpInvoiceToggle = (num_factura) => {
    setBpErrors(prev => ({ ...prev, abonos: '', [`amount_${num_factura}`]: '' }));
    setBpSelections(prev => {
      const current = prev[num_factura] || {};
      return {
        ...prev,
        [num_factura]: { selected: !current.selected, amount: current.selected ? '' : current.amount || '' }
      };
    });
  };

  const handleBpAmountChange = (num_factura, value) => {
    setBpErrors(prev => ({ ...prev, abonos: '', [`amount_${num_factura}`]: '' }));
    setBpSelections(prev => ({
      ...prev,
      [num_factura]: { ...(prev[num_factura] || {}), selected: true, amount: value }
    }));
  };

  const handleBpAutoDistribute = () => {
    if (!bpCustomer || !bpInvoices.length) return;
    const total = parseFloat(bpTotalCredit);
    if (!bpTotalCredit || Number.isNaN(total) || total <= 0) {
      setBpErrors(prev => ({ ...prev, total: 'Ingresa primero el monto total del pago' }));
      return;
    }
    setBpSelections(autoDistribute(total, bpInvoices));
    setBpErrors(prev => ({ ...prev, total: '', abonos: '' }));
  };

  const handleBpClearSelections = () => {
    setBpSelections({});
    setBpErrors(prev => ({ ...prev, abonos: '' }));
  };

  const validateBatchPaymentForm = () => {
    const errors = {};
    const totalCredit = parseFloat(bpTotalCredit);
    const fechaPago = bpDate ? new Date(`${bpDate}T00:00:00`) : null;

    if (!bpCustomer) {
      errors.cliente = 'Debes seleccionar un cliente antes de continuar';
    }

    if (!bpDate || Number.isNaN(fechaPago?.getTime())) {
      errors.fecha = 'Indica la fecha en que se realizó el pago';
    }

    if (!bpTotalCredit || Number.isNaN(totalCredit) || totalCredit <= 0) {
      errors.total = 'Ingresa el monto total que el cliente pagó';
    } else if (totalCredit > bpTotalPendiente) {
      errors.total = `El monto ingresado supera lo que este cliente debe. El máximo es ${formatMoney(bpTotalPendiente)}`;
    }

    if (bpNotas && bpNotas.trim().length > 500) {
      errors.notas = 'Las notas no pueden superar los 500 caracteres';
    }

    const selectedAbonos = bpInvoices
      .filter(inv => bpSelections[inv.num_factura]?.selected && bpSelections[inv.num_factura]?.amount)
      .map(inv => ({
        num_factura: inv.num_factura,
        valor_abono: parseFloat(bpSelections[inv.num_factura].amount),
        saldo_pendiente: parseFloat(inv.saldo_pendiente)
      }));

    if (selectedAbonos.length === 0) {
      errors.abonos = 'Selecciona al menos una factura a la que aplicar el pago';
    }

    for (const abono of selectedAbonos) {
      if (!Number.isFinite(abono.valor_abono) || abono.valor_abono <= 0) {
        errors[`amount_${abono.num_factura}`] = 'El monto de esta factura no es válido';
      } else if (abono.valor_abono > abono.saldo_pendiente) {
        errors[`amount_${abono.num_factura}`] = `El monto supera el saldo de esta factura (${formatMoney(abono.saldo_pendiente)})`;
      }
    }

    if (bpRemaining > 0.01) {
      errors.abonos = `Todavía quedan ${formatMoney(bpRemaining)} sin asignar a ninguna factura`;
    }
    if (bpRemaining < -0.01) {
      errors.abonos = `El total distribuido en facturas supera el monto del pago por ${formatMoney(Math.abs(bpRemaining))}`;
    }

    return {
      errors,
      selectedAbonos: selectedAbonos.map(({ num_factura, valor_abono }) => ({ num_factura, valor_abono }))
    };
  };

  const handleBatchPaymentSubmit = withBatchPaymentSubmit(async (e) => {
    e.preventDefault();
    const { errors, selectedAbonos } = validateBatchPaymentForm();
    if (Object.keys(errors).length > 0) {
      setBpErrors(errors);
      const firstError = Object.values(errors)[0];
      showToast(firstError, 'error');
      return;
    }

    const result = await cuentasService.createBatchAbono({
      cliente_id: bpCustomer.id,
      fecha: bpDate,
      metodo_pago: bpMetodoPago,
      notas: bpNotas.trim() || null,
      abonos: selectedAbonos
    });

    if (result.success) {
      showToast(result.message || 'Pagos registrados exitosamente', 'success');
      closeBatchPaymentModal();
      await loadData();
    } else {
      showToast(result.message, 'error');
    }
  });


  // ============================================
  // REPORT FILTERING
  // ============================================

  const toReportDate = (dateValue) => {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') {
      const normalized = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      const onlyDate = dateValue.split('T')[0];
      const fallback = new Date(`${onlyDate}T00:00:00`);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // ============================================
  // FACTURAS TABLE FILTERING
  // ============================================

  const filteredFacturas = useMemo(() => {
    const rows = reporte.filter((row) => {
      const rowDate = toReportDate(row.fecha_factura);
      const startDate = toReportDate(facturaFilters.fechaInicio);
      const endDate = toReportDate(facturaFilters.fechaFin);

      if (startDate && rowDate && rowDate < startDate) return false;
      if (endDate && rowDate && rowDate > endDate) return false;
      if (facturaFilters.conSaldo && (row.cancelada || parseFloat(row.saldo_pendiente) <= 0)) return false;
      if (facturaFilters.estado === 'activa' && row.cancelada) return false;
      if (facturaFilters.estado === 'anulada' && !row.cancelada) return false;

      if (facturaFilters.search) {
        const search = facturaFilters.search.trim().toLowerCase();
        const matchFactura = String(row.num_factura || '').toLowerCase().includes(search);
        const matchCliente = String(row.cliente || '').toLowerCase().includes(search);
        if (!matchFactura && !matchCliente) return false;
      }

      return true;
    });

    if (facturaTableSort.field) {
      return [...rows].sort((a, b) => {
        const direction = facturaTableSort.direction === 'asc' ? 1 : -1;
        if (facturaTableSort.field === 'num_factura') {
          return (Number(a.num_factura) - Number(b.num_factura)) * direction;
        }
        if (facturaTableSort.field === 'cliente') {
          return String(a.cliente || '').localeCompare(String(b.cliente || ''), 'es', {
            sensitivity: 'base',
            numeric: true
          }) * direction;
        }
        if (facturaTableSort.field === 'identificacion') {
          return String(a.identificacion || '').localeCompare(String(b.identificacion || ''), 'es', {
            sensitivity: 'base',
            numeric: true
          }) * direction;
        }
        if (facturaTableSort.field === 'fecha_factura') {
          const aDate = toReportDate(a.fecha_factura)?.getTime() || 0;
          const bDate = toReportDate(b.fecha_factura)?.getTime() || 0;
          return (aDate - bDate) * direction;
        }
        return 0;
      });
    }

    if (!facturaFilters.ordenAlfabetico) return rows;

    const groups = new Map();
    for (const row of rows) {
      const groupKey = String(row.identificacion || row.cliente || '');
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(row);
    }

    const orderedGroups = Array.from(groups.values())
      .map(items => ({
        items,
        minNumFactura: Math.min(...items.map(item => Number(item.num_factura) || Number.MAX_SAFE_INTEGER)),
        cliente: String(items[0]?.cliente || '')
      }))
      .sort((a, b) => {
        const byMinNum = a.minNumFactura - b.minNumFactura;
        if (byMinNum !== 0) return byMinNum;
        return a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base', numeric: true });
      });

    return orderedGroups.flatMap(group =>
      group.items.sort((a, b) => Number(a.num_factura) - Number(b.num_factura))
    );
  }, [facturaFilters, facturaTableSort, reporte]);

  const totalPages = Math.max(1, Math.ceil(filteredFacturas.length / ROWS_PER_PAGE));
  const paginatedFacturas = filteredFacturas.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const filteredPagos = useMemo(() => {
    const rows = pagos.filter((pago) => {
      const pagoDate = toReportDate(pago.fecha);
      const startDate = toReportDate(pagoFilters.fechaInicio);
      const endDate = toReportDate(pagoFilters.fechaFin);

      if (startDate && pagoDate && pagoDate < startDate) return false;
      if (endDate && pagoDate && pagoDate > endDate) return false;
      if (pagoFilters.metodoPago && String(pago.metodo_pago || '').toLowerCase() !== pagoFilters.metodoPago) return false;

      if (pagoFilters.search) {
        const search = pagoFilters.search.trim().toLowerCase();
        const total = Number(pago.total || 0);
        const matchCliente = String(pago.cliente || '').toLowerCase().includes(search);
        const matchValor = String(pago.total || '').toLowerCase().includes(search)
          || total.toFixed(2).includes(search)
          || formatMoney(total).toLowerCase().includes(search);
        if (!matchCliente && !matchValor) return false;
      }

      return true;
    });

    const getPagoCreatedTime = (pago) => (
      toReportDate(pago.created_at)?.getTime()
      || toReportDate(pago.fecha)?.getTime()
      || 0
    );

    if (pagoFilters.agruparCliente) {
      const groups = new Map();
      for (const row of rows) {
        const groupKey = String(row.cliente_id || row.identificacion || row.cliente || '');
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(row);
      }

      return Array.from(groups.values())
        .map(items => ({
          cliente: String(items[0]?.cliente || ''),
          minCreatedAt: Math.min(...items.map(item => getPagoCreatedTime(item) || Number.MAX_SAFE_INTEGER)),
          items
        }))
        .sort((a, b) => {
          const byCliente = a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base', numeric: true });
          if (byCliente !== 0) return byCliente;
          return a.minCreatedAt - b.minCreatedAt;
        })
        .flatMap(group =>
          group.items.sort((a, b) => {
            const byCreatedAt = getPagoCreatedTime(b) - getPagoCreatedTime(a);
            if (byCreatedAt !== 0) return byCreatedAt;
            return Number(b.id) - Number(a.id);
          })
        );
    }

    return [...rows].sort((a, b) => {
      const direction = pagoTableSort.direction === 'asc' ? 1 : -1;
      if (pagoTableSort.field === 'fecha') {
        const aDate = toReportDate(a.fecha)?.getTime() || 0;
        const bDate = toReportDate(b.fecha)?.getTime() || 0;
        const byDate = (aDate - bDate) * direction;
        if (byDate !== 0) return byDate;
        return (Number(a.id) - Number(b.id)) * direction;
      }
      if (pagoTableSort.field === 'total') {
        const byTotal = (Number(a.total || 0) - Number(b.total || 0)) * direction;
        if (byTotal !== 0) return byTotal;
        const bDate = toReportDate(b.fecha)?.getTime() || 0;
        const aDate = toReportDate(a.fecha)?.getTime() || 0;
        return bDate - aDate;
      }
      return 0;
    });
  }, [pagoFilters, pagoTableSort, pagos]);

  const pagosTotalPages = Math.max(1, Math.ceil(filteredPagos.length / PAGOS_ROWS_PER_PAGE));
  const paginatedPagos = filteredPagos.slice((pagosCurrentPage - 1) * PAGOS_ROWS_PER_PAGE, pagosCurrentPage * PAGOS_ROWS_PER_PAGE);

  useEffect(() => {
    setPagosCurrentPage(page => Math.min(page, pagosTotalPages));
  }, [pagosTotalPages]);

  const handleFacturaTableSort = (field) => {
    setFacturaTableSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const handlePagoTableSort = (field) => {
    setPagoTableSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: field === 'fecha' ? 'desc' : 'asc' };
    });
  };

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
    const cleared = { ...DEFAULT_FACTURA_FILTERS };
    setFacturaFiltersDraft(cleared);
    setFacturaFilters(cleared);
    setCurrentPage(1);
  };

  const applyFacturaFiltersAndReset = () => {
    setFacturaFilters(facturaFiltersDraft);
    setCurrentPage(1);
  };

  const handlePagoFilterChange = (e) => {
    const { name, value } = e.target;
    setPagoFiltersDraft(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyPagoFilters = () => {
    setPagoFilters(pagoFiltersDraft);
    setPagosCurrentPage(1);
  };

  const clearPagoFilters = () => {
    const cleared = { ...DEFAULT_PAGO_FILTERS };
    setPagoFiltersDraft(cleared);
    setPagoFilters(cleared);
    setPagosCurrentPage(1);
  };

  const handleReportFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setReportFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleExportExcel = withReporteExportSubmit(async () => {
    const params = {};
    if (reportFilters.fechaInicio) params.fecha_inicio = reportFilters.fechaInicio;
    if (reportFilters.fechaFin) params.fecha_fin = reportFilters.fechaFin;
    if (reportFilters.soloDeudores) params.solo_deudores = true;
    if (reportFilters.agruparCliente) params.agrupar_cliente = true;

    const result = await cuentasService.exportExcel(params);
    if (result.success) {
      showToast('Reporte exportado exitosamente', 'success');
    } else {
      showToast(result.message || 'Error al exportar', 'error');
    }
  });

  const handleExportClientesExcel = withClientesExportSubmit(async () => {
    const result = await cuentasService.exportClientesExcel();
    if (result.success) {
      setShowClientesReporteConfirm(false);
      showToast('Reporte de clientes exportado exitosamente', 'success');
      return;
    }
    if (!result.cancelled) {
      showToast(result.message || 'Error al exportar clientes', 'error');
    }
  });

  const handlePagosReportFilterChange = (e) => {
    const { name, value } = e.target;
    setPagosReportFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleExportPagosExcel = withPagosExportSubmit(async () => {
    const params = {};
    if (pagosReportFilters.fechaInicio) params.fecha_inicio = pagosReportFilters.fechaInicio;
    if (pagosReportFilters.fechaFin) params.fecha_fin = pagosReportFilters.fechaFin;
    if (pagosReportFilters.metodoPago) params.metodo_pago = pagosReportFilters.metodoPago;

    const result = await cuentasService.exportPagosExcel(params);
    if (result.success) {
      showToast('Reporte de pagos exportado exitosamente', 'success');
      setShowPagosReporteModal(false);
      return;
    }
    if (!result.cancelled) {
      showToast(result.message || 'Error al exportar pagos', 'error');
    }
  });

  // ============================================
  // BATCH PAYMENT COMPUTED VALUES
  // ============================================

  const bpFilteredClientes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(bpCustomerSearch.toLowerCase()) ||
    c.identificacion.toLowerCase().includes(bpCustomerSearch.toLowerCase())
  );

  const bpInvoices = bpCustomer
    ? reporte
        .filter(r => Number(r.cliente_id) === bpCustomer.id && !r.cancelada && parseFloat(r.saldo_pendiente) > 0)
        .sort((a, b) => {
          const dateDiff = new Date(a.fecha_factura) - new Date(b.fecha_factura);
          if (dateDiff !== 0) return dateDiff;
          return Number(a.num_factura) - Number(b.num_factura);
        })
    : [];

  const bpTotalPendiente = bpInvoices.reduce((sum, inv) => sum + parseFloat(inv.saldo_pendiente), 0);
  const bpTotalAllocated = bpInvoices.reduce((sum, inv) => {
    const sel = bpSelections[inv.num_factura];
    return sum + (sel?.selected && sel?.amount ? parseFloat(sel.amount) || 0 : 0);
  }, 0);
  const bpRemaining = Math.round((parseFloat(bpTotalCredit || 0) - bpTotalAllocated) * 100) / 100;


  // ============================================
  // SUMMARY TOTALS
  // ============================================

  const totals = filteredFacturas
    .filter(row => !row.cancelada)
    .reduce((acc, row) => ({
      subtotal: acc.subtotal + parseFloat(row.subtotal || 0),
      iva: acc.iva + parseFloat(row.iva || 0),
      total: acc.total + parseFloat(row.subtotal || 0) + parseFloat(row.iva || 0),
      retencion_fuente: acc.retencion_fuente + parseFloat(row.retencion_fuente || 0),
      retencion_iva: acc.retencion_iva + parseFloat(row.retencion_iva || 0),
      por_cobrar: acc.por_cobrar + parseFloat(row.por_cobrar || 0),
      total_abonos: acc.total_abonos + parseFloat(row.total_abonos || 0),
      saldo_pendiente: acc.saldo_pendiente + parseFloat(row.saldo_pendiente || 0)
    }), { subtotal: 0, iva: 0, total: 0, retencion_fuente: 0, retencion_iva: 0, por_cobrar: 0, total_abonos: 0, saldo_pendiente: 0 });

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="cuentas-container">
      {/* Header with back navigation */}
      <header className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate('/')} title="Volver al Dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h1>Control de Cuentas</h1>
        </div>
        {activeTab === 'facturas' && (
          <div className="page-header-actions">
            {isGerente && (
              <button className="btn btn-ghost btn-sm" onClick={openCreateFacturaModal}>Crear factura</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowReporteModal(true)}>Generar reporte</button>
            <button className="btn btn-ghost btn-sm btn-icon-only" onClick={loadData} title="Actualizar datos">↻</button>
          </div>
        )}
        {activeTab === 'pagos' && (
          <div className="page-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowBatchPaymentModal(true)}>Registrar pago</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPagosReporteModal(true)}>Generar reporte</button>
            <button className="btn btn-ghost btn-sm btn-icon-only" onClick={loadData} title="Actualizar datos">↻</button>
          </div>
        )}
        {activeTab === 'clientes' && (
          <div className="page-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowClienteForm(!showClienteForm)}>
              {showClienteForm ? 'Cancelar' : 'Crear cliente'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowClientesReporteConfirm(true)}>
              Generar reporte
            </button>
            <button className="btn btn-ghost btn-sm btn-icon-only" onClick={loadData} title="Actualizar datos">↻</button>
          </div>
        )}
      </header>


      {loading ? (
        <div className="loading-spinner-wrap">
          <span className="spinner" />
          <span>Cargando datos…</span>
        </div>
      ) : (
        <>
          {loadError && (
            <div className="cuentas-error-banner" role="alert">
              <svg className="cuentas-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{loadError}</span>
              <button className="btn btn-danger btn-sm" onClick={loadData} type="button">
                Reintentar
              </button>
            </div>
          )}
          {/* Tabs */}
          <div className="cuentas-tabs">
            <button
              className={`tab ${activeTab === 'facturas' ? 'active' : ''}`}
              onClick={() => setActiveTab('facturas')}
            >
              Facturas
              {reporte.length > 0 && (
                <span className="tab-badge">{reporte.length}</span>
              )}
            </button>
            <button
              className={`tab ${activeTab === 'pagos' ? 'active' : ''}`}
              onClick={() => setActiveTab('pagos')}
            >
              Pagos
              {pagos.length > 0 && (
                <span className="tab-badge">{pagos.length}</span>
              )}
            </button>
            <button
              className={`tab ${activeTab === 'clientes' ? 'active' : ''}`}
              onClick={() => setActiveTab('clientes')}
            >
              Clientes
              {clientes.length > 0 && (
                <span className="tab-badge">{clientes.length}</span>
              )}
            </button>
          </div>

          {/* FACTURAS TAB */}
          {activeTab === 'facturas' && (
            <div className="tab-content">
              <div className="ff-filter-row facturas-filter-row">
                <div className="ff-filter-card facturas-filter-card">
                  <div className="ff-controls">
                    <div className="ff-search">
                      <svg className="ff-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="text"
                        name="search"
                        value={facturaFiltersDraft.search}
                        onChange={handleFacturaFilterChange}
                        onKeyDown={(e) => e.key === 'Enter' && applyFacturaFiltersAndReset()}
                        placeholder="N° factura o cliente..."
                      />
                    </div>
                    <div className="ff-dates">
                      <div className="ff-date-field">
                        <span className="ff-date-label">Desde</span>
                        <input type="date" name="fechaInicio" value={facturaFiltersDraft.fechaInicio} onChange={handleFacturaFilterChange} />
                      </div>
                      <div className="ff-date-field">
                        <span className="ff-date-label">Hasta</span>
                        <input type="date" name="fechaFin" value={facturaFiltersDraft.fechaFin} onChange={handleFacturaFilterChange} />
                      </div>
                    </div>
                    <div className="ff-state">
                      <span className="ff-state-label">Estado</span>
                      <select name="estado" value={facturaFiltersDraft.estado} onChange={handleFacturaFilterChange}>
                        <option value="">Todas</option>
                        <option value="activa">Activas</option>
                        <option value="anulada">Anuladas</option>
                      </select>
                    </div>
                    <div className="ff-pills">
                      <button
                        type="button"
                        className={`ff-pill${facturaFiltersDraft.conSaldo ? ' active' : ''}`}
                        onClick={() => setFacturaFiltersDraft(prev => ({ ...prev, conSaldo: !prev.conSaldo }))}
                      >Con deuda</button>
                      <button
                        type="button"
                        className={`ff-pill${facturaFiltersDraft.ordenAlfabetico ? ' active' : ''}`}
                        onClick={() => setFacturaFiltersDraft(prev => ({ ...prev, ordenAlfabetico: !prev.ordenAlfabetico }))}
                      >Agrupar por cliente</button>
                    </div>
                  </div>
                </div>
                <div className="ff-filter-actions-card facturas-filter-actions-card">
                  <div className="ff-actions">
                    <button className="btn btn-primary btn-sm" type="button" onClick={applyFacturaFiltersAndReset}>Aplicar</button>
                    <button className="ff-clear-btn" type="button" onClick={clearFacturaFilters}>Limpiar</button>
                  </div>
                </div>
              </div>


              {/* Main Data Table */}
              <div className="table-responsive app-table-shell">
                <table className="app-table cuentas-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleFacturaTableSort('num_factura')}>
                          N° Fact
                          <span className={`th-sort-indicator${facturaTableSort.field === 'num_factura' ? ' active' : ''}`}>
                            {facturaTableSort.field === 'num_factura' && facturaTableSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleFacturaTableSort('fecha_factura')}>
                          Fecha
                          <span className={`th-sort-indicator${facturaTableSort.field === 'fecha_factura' ? ' active' : ''}`}>
                            {facturaTableSort.field === 'fecha_factura' && facturaTableSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handleFacturaTableSort('cliente')}>
                          Cliente
                          <span className={`th-sort-indicator${facturaTableSort.field === 'cliente' ? ' active' : ''}`}>
                            {facturaTableSort.field === 'cliente' && facturaTableSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th className="col-money" title="Subtotal">Subt.</th>
                      <th className="col-money">IVA</th>
                      <th className="col-money">Total</th>
                      <th className="col-money" title="Retención fuente">Ret. Fte.</th>
                      <th className="col-money">Ret. IVA</th>
                      <th className="col-money" title="Por cobrar">X Cob.</th>
                      <th className="col-money" title="Abonos">Abon.</th>
                      <th className="col-money">Saldo</th>
                      <th className="col-actions app-col-actions app-col-actions--double"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFacturas.length > 0 ? (
                      paginatedFacturas.map((row, idx) => (
                        <tr key={row.num_factura} className={`${idx % 2 === 0 ? 'row-even' : 'row-odd'} ${row.cancelada ? 'row-canceled' : ''}`}>
                          <td className="cell-factura">
                            <span className="cell-factura-num">{row.num_factura}</span>
                          </td>
                          <td className="app-cell-date">{formatDate(row.fecha_factura)}</td>
                          <td className="cell-cliente" title={row.cliente}>{row.cliente}</td>
                          <td className="col-money">{formatMoney(row.subtotal)}</td>
                          <td className="col-money">{formatMoney(row.iva)}</td>
                          <td className="col-money">{formatMoney(parseFloat(row.subtotal || 0) + parseFloat(row.iva || 0))}</td>
                          <td className="col-money">{formatMoney(row.retencion_fuente)}</td>
                          <td className="col-money">{formatMoney(row.retencion_iva)}</td>
                          <td className="col-money">{formatMoney(row.por_cobrar)}</td>
                          <td className="col-money">{formatMoney(row.total_abonos)}</td>
                          <td className={`col-money ${parseFloat(row.saldo_pendiente) > 0 ? 'text-danger' : 'text-success'}`}>
                            {formatMoney(row.saldo_pendiente)}
                          </td>
                          <td className="col-actions app-col-actions app-col-actions--double">
                            <div className="action-buttons app-table-actions">
                              {row.cancelada ? (
                                <button
                                  className="action-btn action-btn-info"
                                  onClick={() => setAnulacionModal(row)}
                                  title="Ver detalle de anulación"
                                  type="button"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.2"/>
                                    <line x1="12" y1="8" x2="12" y2="8.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                                    <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                                  </svg>
                                </button>
                              ) : isGerente ? (
                                <>
                                  <button
                                    className="action-btn action-btn-edit"
                                    onClick={() => openEditFacturaModal(row)}
                                    title="Editar Factura"
                                    type="button"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                  <button
                                    className="action-btn action-btn-cancel"
                                    onClick={() => openCancelFacturaModal(row)}
                                    title="Anular Factura"
                                    type="button"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                </>
                              ) : null}
                              {isGerente && (
                                <button
                                  className="action-btn action-btn-del"
                                  onClick={() => requestDeleteFactura(row)}
                                  title="Eliminar Factura"
                                  type="button"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M6 7h12M9 7v10m6-10v10M9 7h6M10 4h4l1 2H9l1-2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="12" className="text-center">
                          {filteredFacturas.length === 0
                            ? (facturaFilters.search || facturaFilters.fechaInicio || facturaFilters.fechaFin || facturaFilters.conSaldo || facturaFilters.estado
                              ? 'No hay facturas para los filtros seleccionados'
                              : 'No hay facturas registradas')
                            : 'No hay más facturas en esta página'}
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Summary Totals Footer — only on last page */}
                  {paginatedFacturas.length > 0 && currentPage === totalPages && (
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan="3" className="totals-label">TOTALES</td>
                        <td className="col-money">{formatMoney(totals.subtotal)}</td>
                        <td className="col-money">{formatMoney(totals.iva)}</td>
                        <td className="col-money">{formatMoney(totals.total)}</td>
                        <td className="col-money">{formatMoney(totals.retencion_fuente)}</td>
                        <td className="col-money">{formatMoney(totals.retencion_iva)}</td>
                        <td className="col-money">{formatMoney(totals.por_cobrar)}</td>
                        <td className="col-money">{formatMoney(totals.total_abonos)}</td>
                        <td className={`col-money ${totals.saldo_pendiente > 0 ? 'text-danger' : 'text-success'}`}>
                          {formatMoney(totals.saldo_pendiente)}
                        </td>
                        <td className="col-actions"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pagination */}
              {filteredFacturas.length > 0 && (
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Anterior
                  </button>
                  <span className="pagination-info">
                    Página <span className="pagination-count">{currentPage}</span> de {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente ›
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PAGOS TAB */}
          {activeTab === 'pagos' && (
            <div className="tab-content">
              <div className="ff-filter-row pagos-filter-row">
                <div className="ff-filter-card pagos-filter-card">
                  <div className="ff-controls">
                    <div className="ff-search">
                      <svg className="ff-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="text"
                        name="search"
                        value={pagoFiltersDraft.search}
                        onChange={handlePagoFilterChange}
                        onKeyDown={(e) => e.key === 'Enter' && applyPagoFilters()}
                        placeholder="Cliente o valor..."
                      />
                    </div>
                    <div className="ff-dates">
                      <div className="ff-date-field">
                        <span className="ff-date-label">Desde</span>
                        <input type="date" name="fechaInicio" value={pagoFiltersDraft.fechaInicio} onChange={handlePagoFilterChange} />
                      </div>
                      <div className="ff-date-field">
                        <span className="ff-date-label">Hasta</span>
                        <input type="date" name="fechaFin" value={pagoFiltersDraft.fechaFin} onChange={handlePagoFilterChange} />
                      </div>
                    </div>
                    <div className="ff-state">
                      <span className="ff-state-label">Método</span>
                      <select name="metodoPago" value={pagoFiltersDraft.metodoPago} onChange={handlePagoFilterChange}>
                        <option value="">Todos</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="cheque">Cheque</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div className="ff-pills">
                      <button
                        type="button"
                        className={`ff-pill${pagoFiltersDraft.agruparCliente ? ' active' : ''}`}
                        onClick={() => setPagoFiltersDraft(prev => ({ ...prev, agruparCliente: !prev.agruparCliente }))}
                      >Agrupar por cliente</button>
                    </div>
                  </div>
                </div>
                <div className="ff-filter-actions-card pagos-filter-actions-card">
                  <div className="ff-actions">
                    <button className="btn btn-primary btn-sm" type="button" onClick={applyPagoFilters}>Aplicar</button>
                    <button className="ff-clear-btn" type="button" onClick={clearPagoFilters}>Limpiar</button>
                  </div>
                </div>
              </div>

              <div className="table-responsive app-table-shell pagos-table-shell">
                <table className="app-table pagos-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="th-sort-btn" onClick={() => handlePagoTableSort('fecha')}>
                          Fecha
                          <span className={`th-sort-indicator${pagoTableSort.field === 'fecha' ? ' active' : ''}`}>
                            {pagoTableSort.field === 'fecha' && pagoTableSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
	                      <th>Cliente</th>
	                      <th>Método de pago</th>
	                      <th className="col-money">
                        <button type="button" className="th-sort-btn" onClick={() => handlePagoTableSort('total')}>
                          Valor
                          <span className={`th-sort-indicator${pagoTableSort.field === 'total' ? ' active' : ''}`}>
                            {pagoTableSort.field === 'total' && pagoTableSort.direction === 'desc' ? '↓' : '↑'}
                          </span>
	                        </button>
	                      </th>
	                      <th>Facturas</th>
                      {isGerente && <th className="col-actions app-col-actions"></th>}
	                    </tr>
	                  </thead>
                  <tbody>
                    {paginatedPagos.length > 0 ? (
                      paginatedPagos.map((pago, idx) => (
                        <tr
                          key={pago.id}
                          className={`${idx % 2 === 0 ? 'row-even' : 'row-odd'} clickable-row`}
                          onClick={() => openPagoDetailModal(pago)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openPagoDetailModal(pago);
                            }
                          }}
                        >
                          <td className="app-cell-date">{formatDate(pago.fecha)}</td>
                          <td className="cell-cliente" title={pago.cliente}>{pago.cliente}</td>
                          <td>{formatMetodoPago(pago.metodo_pago)}</td>
                          <td className="col-money">{formatMoney(pago.total)}</td>
	                          <td>
	                            <span className="payment-invoices-chip">
	                              {pago.facturas_count || pago.facturas?.length || 0} factura(s)
	                            </span>
	                          </td>
                          {isGerente && (
                            <td className="col-actions app-col-actions">
                              <div className="action-buttons app-table-actions">
                                <button
                                  className="action-btn action-btn-del"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPagoToDelete(pago);
                                  }}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  title="Eliminar pago"
                                  type="button"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M6 7h12M9 7v10m6-10v10M9 7h6M10 4h4l1 2H9l1-2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
	                        </tr>
	                      ))
	                    ) : (
	                      <tr>
	                        <td colSpan={isGerente ? 6 : 5} className="text-center">
                          {pagoFilters.search || pagoFilters.fechaInicio || pagoFilters.fechaFin || pagoFilters.metodoPago
                            ? 'No hay pagos para los filtros seleccionados'
                            : 'No hay pagos registrados'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {pagosTotalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPagosCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pagosCurrentPage === 1}
                  >
                    ‹ Anterior
                  </button>
                  <span className="pagination-info">
                    Página <span className="pagination-count">{pagosCurrentPage}</span> de {pagosTotalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPagosCurrentPage(p => Math.min(pagosTotalPages, p + 1))}
                    disabled={pagosCurrentPage === pagosTotalPages}
                  >
                    Siguiente ›
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CLIENTES TAB */}
          {activeTab === 'clientes' && (
            <div className="tab-content">
              <Clientes
                clientes={clientes}
                onClienteCreated={loadData}
                onClienteDeleted={loadData}
                showClienteForm={showClienteForm}
                setShowClienteForm={setShowClienteForm}
              />
            </div>
          )}

          {/* ============================================ */}
          {/* PAGO DETAIL MODAL */}
          {/* ============================================ */}
          {selectedPago && (
            <div className="modal-overlay" onClick={closePagoDetailModal}>
              <div className="modal pago-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Pago #{selectedPago.id}</h3>
                  <button className="modal-close" onClick={closePagoDetailModal}>×</button>
                </div>
                <div className="modal-context pago-detail-context">
                  <span>Cliente: <strong>{selectedPago.cliente}</strong></span>
                  <span>Fecha: <strong>{formatDate(selectedPago.fecha)}</strong></span>
                  <span>Método: <strong>{formatMetodoPago(selectedPago.metodo_pago)}</strong></span>
                  <span>Total: <strong>{formatMoney(selectedPago.total)}</strong></span>
                </div>
                {(selectedPago.referencia || selectedPago.notas) && (
                  <div className="pago-detail-notes">
                    {selectedPago.referencia ? <p><strong>Referencia:</strong> {selectedPago.referencia}</p> : null}
                    {selectedPago.notas ? <p><strong>Notas:</strong> {selectedPago.notas}</p> : null}
                  </div>
                )}
                <div className="table-responsive pago-detail-table-shell">
                  <table className="app-table pago-detail-table">
                    <thead>
                      <tr>
                        <th>N° Fact</th>
                        <th>Fecha factura</th>
                        <th className="col-money">Valor factura</th>
                        <th className="col-money">Aplicado</th>
                        <th className="col-money">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPago.facturas?.length > 0 ? (
                        selectedPago.facturas.map((factura) => (
                          <tr key={`${selectedPago.id}-${factura.abono_id || factura.num_factura}`}>
                            <td className="cell-factura">#{factura.num_factura}</td>
                            <td className="app-cell-date">{formatDate(factura.fecha_factura)}</td>
                            <td className="col-money">{formatMoney(factura.valor_factura)}</td>
                            <td className="col-money">{formatMoney(factura.valor_abono)}</td>
                            <td className="col-money">{formatMoney(factura.saldo_pendiente)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center">Este pago no tiene facturas asociadas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            isOpen={!!pagoToDelete}
            title="Eliminar pago"
            message={pagoToDelete ? (
              <div className="delete-invoice-confirm">
                <p>
                  Vas a eliminar permanentemente el pago <strong>#{pagoToDelete.id}</strong> de <strong>{pagoToDelete.cliente}</strong>.
                </p>
                <p>
                  También se eliminarán los abonos asociados y se recalcularán los saldos de sus facturas.
                </p>
              </div>
            ) : ''}
            confirmText="Eliminar"
            cancelText="Cancelar"
            variant="danger"
            onConfirm={handleDeletePagoConfirmed}
            onCancel={() => setPagoToDelete(null)}
          />

          {/* ============================================ */}
          {/* CREAR FACTURA MODAL */}
          {/* ============================================ */}
          {showFacturaModal && (
            <div className="modal-overlay" onClick={closeFacturaModal}>
              <div className="modal modal-factura" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Crear Nueva Factura</h3>
                  <button className="modal-close" onClick={closeFacturaModal}>×</button>
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
                        onBlur={flushFacturaNumericInputs}
                        placeholder="Ej: 1006"
                        autoFocus
                        step="1"
                      />
                      {numFacturaError ? <span className="field-error">{numFacturaError}</span> : null}
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
                      {selectedCliente ? (
                        <div className="selected-client-summary">
                          <div className="selected-client-row">
                            <span className="selected-client-label">Identificación</span>
                            <strong>{selectedCliente.identificacion}</strong>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="form-group">
                      <label>Fecha</label>
                      <input
                        type="date"
                        name="fecha_factura"
                        value={formData.fecha_factura}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Subtotal</label>
                      <div className="money-input-wrapper">
                        <span className="money-input-prefix">$</span>
                        <input
                          type="number"
                          name="valor_factura"
                          step="0.01"
                          value={formData.valor_factura}
                          onChange={handleFormChange}
                          onBlur={flushFacturaNumericInputs}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {shouldShowFacturaCalculation && (
                    <div className="factura-calc-sections modal-checkboxes-section--animated">
                      <div className="factura-card">
                        <span className="factura-preview-title">Retenciones e IVA</span>
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
                            Retención de fuente (3%)
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
                        {facturaErrors.incluye_retencion_iva ? (
                          <span className="field-error">{facturaErrors.incluye_retencion_iva}</span>
                        ) : null}
                      </div>

                      <div className="factura-preview factura-card">
                        <span className="factura-preview-title">Resumen calculado</span>
                        <div className="factura-preview-grid">
                          <span>Subtotal</span>
                          <strong>{formatMoney(facturaPreview.subtotal)}</strong>
                          <span>· IVA (15%)</span>
                          <strong>{formatMoney(facturaPreview.iva)}</strong>
                          <span>· Ret. Fuente (3%)</span>
                          <strong>{formatMoney(facturaPreview.retencionFuente)}</strong>
                          <span>· Ret. IVA (70%)</span>
                          <strong>{formatMoney(facturaPreview.retencionIva)}</strong>
                          <span className="factura-preview-total">Por cobrar</span>
                          <strong className="factura-preview-total">{formatMoney(facturaPreview.porCobrar)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-primary" disabled={isCreatingFactura}>
                      {isCreatingFactura ? <><span className="spinner spinner--sm" />Creando…</> : 'Crear Factura'}
                    </button>
                    <button type="button" className="btn btn-modal-clear" onClick={closeFacturaModal} disabled={isCreatingFactura}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* BATCH PAYMENT MODAL */}
          {/* ============================================ */}
          {showBatchPaymentModal && (
            <div className="modal-overlay" onClick={closeBatchPaymentModal}>
              <div className="modal modal-batch-payment" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-header-content">
                    <h3>Registrar Pago</h3>
                  </div>
                  <button className="modal-close" onClick={closeBatchPaymentModal}>×</button>
                </div>

                <form onSubmit={handleBatchPaymentSubmit}>
                  <div className="bp-form-scroll">

                    {/* Sección 1 — Detalles del pago */}
                    <div className="bp-section">
                      <div className="bp-fields-grid">

                        <div className="form-group bp-amount-group">
                          <label>Monto total</label>
                          <div className="bp-amount-input-wrapper">
                            <span className="bp-amount-prefix">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={bpTotalCredit}
                              onChange={handleBpTotalCreditChange}
                              placeholder="0.00"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="form-group bp-cliente-group">
                          <label>Cliente</label>
                          <div className="bp-cliente-search-container cliente-search-container">
                            <input
                              type="text"
                              value={bpCustomerSearch}
                              onChange={handleBpCustomerSearchChange}
                              onFocus={() => setBpShowDropdown(true)}
                              placeholder="Buscar por nombre o identificación..."
                              autoComplete="off"
                            />
                            {bpShowDropdown && bpCustomerSearch && (
                              <div className="cliente-dropdown">
                                {bpFilteredClientes.length > 0 ? (
                                  bpFilteredClientes.map(c => (
                                    <div key={c.id} className="cliente-option" onClick={() => handleBpCustomerSelect(c)}>
                                      <div className="cliente-nombre">{c.nombre}</div>
                                      <div className="cliente-identificacion">{c.identificacion}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="cliente-option-empty">No se encontraron clientes</div>
                                )}
                              </div>
                            )}
                          </div>
                          {bpCustomer ? (
                            <div className="selected-client-summary">
                              <div className="selected-client-row">
                                <span className="selected-client-label">Identificación</span>
                                <strong>{bpCustomer.identificacion}</strong>
                              </div>
                            </div>
                          ) : null}
                          {bpErrors.cliente ? <span className="field-error">{bpErrors.cliente}</span> : null}
                        </div>

                        <div className="form-group">
                          <label>Fecha</label>
                          <input
                            type="date"
                            value={bpDate}
                            onChange={e => {
                              setBpDate(e.target.value);
                              setBpErrors(prev => ({ ...prev, fecha: '' }));
                            }}
                          />
                          {bpErrors.fecha ? <span className="field-error">{bpErrors.fecha}</span> : null}
                        </div>

                        <div className="form-group">
                          <label>Método</label>
                          <select value={bpMetodoPago} onChange={e => setBpMetodoPago(e.target.value)}>
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="cheque">Cheque</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>

                        <div className="form-group bp-notas-group">
                          <label>Notas <span className="label-optional">(opcional)</span></label>
                          <input
                            type="text"
                            value={bpNotas}
                            onChange={e => {
                              setBpNotas(e.target.value);
                              setBpErrors(prev => ({ ...prev, notas: '' }));
                            }}
                            placeholder="Detalle adicional del pago..."
                            maxLength={500}
                          />
                          {bpErrors.notas ? <span className="field-error">{bpErrors.notas}</span> : null}
                        </div>

                      </div>
                    </div>

                    {/* Sección 2 — Distribución en facturas */}
                    {bpCustomer && (
                      <div className="bp-section">
                        <div className="bp-section-header">
                          <div>
                            <span className="bp-section-title">Distribución en facturas</span>
                            <span className="bp-total-pendiente">
                              {bpInvoices.length} factura{bpInvoices.length !== 1 ? 's' : ''} · {formatMoney(bpTotalPendiente)} pendiente
                            </span>
                          </div>
                          <div className="bp-quick-pills">
                            <button type="button" className="bp-pill" onClick={handleBpAutoDistribute} title="Distribuir automáticamente según el monto ingresado">
                              Auto
                            </button>
                            <button type="button" className="bp-pill bp-pill-clear" onClick={handleBpClearSelections} title="Limpiar distribución">
                              ✕
                            </button>
                          </div>
                        </div>

                        {bpInvoices.length > 0 ? (
                          <>
                            <div className="bp-invoices-list">
                              {bpInvoices.map(inv => {
                                const sel = bpSelections[inv.num_factura] || {};
                                const amtVal = parseFloat(sel.amount || 0);
                                const saldo = parseFloat(inv.saldo_pendiente);
                                const fillPct = saldo > 0 ? Math.min(100, (amtVal / saldo) * 100) : 0;
                                const exceedsSaldo = sel.selected && sel.amount && amtVal > saldo;
                                const rowError = bpErrors[`amount_${inv.num_factura}`];
                                return (
                                  <div
                                    key={inv.num_factura}
                                    className={`bp-invoice-row${sel.selected ? ' selected' : ''}${(exceedsSaldo || rowError) ? ' has-error' : ''}`}
                                    onClick={() => handleBpInvoiceToggle(inv.num_factura)}
                                  >
                                    <div className="bp-invoice-check">
                                      {sel.selected && (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="bp-invoice-body">
                                      <div className="bp-invoice-meta">
                                        <span className="bp-invoice-num">Factura #{inv.num_factura}</span>
                                        <span className="bp-invoice-date">{formatDate(inv.fecha_factura)}</span>
                                        <span className="bp-invoice-saldo">Saldo: {formatMoney(inv.saldo_pendiente)}</span>
                                      </div>
                                      {sel.selected && (
                                        <div className="bp-invoice-progress-wrap">
                                          <div className="bp-invoice-progress">
                                            <div className="bp-invoice-progress-fill" style={{ width: `${fillPct}%` }} />
                                          </div>
                                          <span className="bp-invoice-pct">{fillPct.toFixed(0)}%</span>
                                        </div>
                                      )}
                                      {rowError ? <span className="bp-row-error">{rowError}</span> : null}
                                    </div>
                                    <div className="bp-invoice-right" onClick={e => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        className="bp-pay-full-btn"
                                        onClick={() => handleBpPayFull(inv)}
                                        title="Pagar saldo completo"
                                      >
                                        Todo
                                      </button>
                                      <div className="money-input-wrapper bp-invoice-amount-wrapper">
                                        <span className="money-input-prefix">$</span>
                                        <input
                                          type="number"
                                          className={`bp-invoice-amount-input${(exceedsSaldo || rowError) ? ' error' : ''}`}
                                          value={sel.amount || ''}
                                          onChange={e => handleBpAmountChange(inv.num_factura, e.target.value)}
                                          onClick={e => e.stopPropagation()}
                                          placeholder="0.00"
                                          min="0.01"
                                          step="0.01"
                                          disabled={!sel.selected}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {bpErrors.abonos ? <span className="field-error bp-abonos-error">{bpErrors.abonos}</span> : null}

                            <div className={`bp-progress-section${bpRemaining < -0.01 ? ' over' : ''}`}>
                              <div className="bp-progress-labels">
                                <span>Distribuido <strong>{formatMoney(bpTotalAllocated)}</strong> de <strong>{formatMoney(parseFloat(bpTotalCredit || 0))}</strong></span>
                                {(bpTotalAllocated > 0 || bpRemaining !== 0) && (
                                  <span className={`bp-remaining-label${bpRemaining < -0.01 ? ' negative' : bpRemaining < 0.01 && bpTotalAllocated > 0 ? ' done' : ' pending'}`}>
                                    {bpRemaining > 0.01
                                      ? `Pendiente: ${formatMoney(bpRemaining)}`
                                      : bpRemaining < -0.01
                                      ? `Excede: ${formatMoney(Math.abs(bpRemaining))}`
                                      : '✓ Completamente distribuido'}
                                  </span>
                                )}
                              </div>
                              <div className="bp-progress-track">
                                <div
                                  className="bp-progress-fill"
                                  style={{
                                    width: `${parseFloat(bpTotalCredit || 0) > 0
                                      ? Math.min(100, (bpTotalAllocated / parseFloat(bpTotalCredit)) * 100)
                                      : 0}%`
                                  }}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bp-empty-invoices">Sin facturas con saldo pendiente</div>
                        )}
                      </div>
                    )}

                  </div>

                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-primary" disabled={isSubmittingBatchPayment}>
                      {isSubmittingBatchPayment ? <><span className="spinner spinner--sm" />Registrando…</> : 'Registrar Pago'}
                    </button>
                    <button type="button" className="btn btn-modal-clear" onClick={closeBatchPaymentModal} disabled={isSubmittingBatchPayment}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showCancelFacturaModal && facturaToCancel && (
            <div className="modal-overlay" onClick={closeCancelFacturaModal}>
              <div className="modal modal-cancel-factura" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Anular Factura</h3>
                  <button className="modal-close" onClick={closeCancelFacturaModal}>×</button>
                </div>
                <div className="modal-context">
                  <span>Factura: <strong>#{facturaToCancel.num_factura}</strong></span>
                  <span>Cliente: <strong>{facturaToCancel.cliente}</strong></span>
                </div>
                <form onSubmit={handleCancelFactura}>
                  <div className="form-group">
                    <label>Detalle de anulación</label>
                    <textarea
                      value={cancelDetail}
                      onChange={(e) => setCancelDetail(e.target.value)}
                      placeholder="Explica por qué se anula la factura..."
                      rows={4}
                      maxLength={300}
                    />
                    <span className="field-help">{cancelDetail.length}/300</span>
                  </div>
                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-primary" disabled={isSubmittingCancelFactura}>
                      {isSubmittingCancelFactura ? <><span className="spinner spinner--sm" />Anulando…</> : 'Confirmar anulación'}
                    </button>
                    <button type="button" className="btn btn-modal-clear" onClick={closeCancelFacturaModal} disabled={isSubmittingCancelFactura}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <ConfirmDialog
            isOpen={!!facturaToDelete}
            title="Eliminar factura"
            message={facturaToDelete ? (
              <div className="delete-invoice-confirm">
                <p>
                  Vas a eliminar permanentemente la factura <strong>#{facturaToDelete.num_factura}</strong>.
                </p>
                <p>
                  También se eliminarán sus retenciones y abonos asociados. Esta acción no se puede deshacer.
                </p>
              </div>
            ) : ''}
            confirmText="Eliminar"
            cancelText="Cancelar"
            variant="danger"
            onConfirm={handleDeleteFacturaConfirmed}
            onCancel={() => setFacturaToDelete(null)}
          />

          {/* ============================================ */}
          {/* ANULACION DETAIL MODAL */}
          {/* ============================================ */}
          {anulacionModal && (
            <div className="modal-overlay" onClick={() => setAnulacionModal(null)}>
              <div className="modal modal-anulacion" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Detalle de Anulación — Factura #{anulacionModal.num_factura}</h3>
                  <button className="modal-close" onClick={() => setAnulacionModal(null)}>×</button>
                </div>
                <div className="modal-body anulacion-body">
                  <div className="anulacion-meta">
                    <span className="anulacion-meta-label">Cliente</span>
                    <span>{anulacionModal.cliente}</span>
                    <span className="anulacion-meta-label">Fecha de anulación</span>
                    <span>{formatDateTime(anulacionModal.fecha_anulacion)}</span>
                  </div>
                  <div className="anulacion-detalle">
                    <span className="anulacion-meta-label">Motivo</span>
                    <p>{anulacionModal.detalle_anulacion || 'No se registró un detalle para esta anulación.'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* EDIT FACTURA MODAL (gerente only) */}
          {/* ============================================ */}
          {showEditFacturaModal && editFacturaData && (
            <div className="modal-overlay" onClick={closeEditFacturaModal}>
              <div className="modal modal-factura" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Editar Factura #{editFacturaData.num_factura}</h3>
                  <button className="modal-close" onClick={closeEditFacturaModal}>×</button>
                </div>
                <form onSubmit={handleUpdateFactura}>
                  <div className="modal-form-grid">
                    <div className="form-group cliente-search-group">
                      <label>Cliente</label>
                      <input
                        type="text"
                        value={editFacturaData.cliente || ''}
                        readOnly
                        className="input-readonly"
                        title="El cliente no se puede modificar desde la edición de factura"
                      />
                      {editFacturaErrors.cliente_id ? <span className="field-error">{editFacturaErrors.cliente_id}</span> : null}
                    </div>
                    <div className="form-group">
                      <label>Fecha</label>
                      <input
                        type="date"
                        name="fecha_factura"
                        value={editFormData.fecha_factura}
                        onChange={handleEditFormChange}
                        disabled={!isGerente}
                      />
                    </div>
                    <div className="form-group">
                      <label>Subtotal</label>
                      <div className="money-input-wrapper">
                        <span className="money-input-prefix">$</span>
                        <input
                          type="number"
                          name="valor_factura"
                          step="0.01"
                          value={editFormData.valor_factura}
                          onChange={handleEditFormChange}
                          placeholder="0.00"
                          disabled={!isGerente}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="factura-card" style={{ margin: '1rem 0' }}>
                    <span className="factura-preview-title">Retenciones e IVA</span>
                    <div className="modal-checkboxes">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="incluye_iva"
                          checked={editFormData.incluye_iva}
                          onChange={handleEditFormChange}
                        />
                        Incluye IVA (15%)
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="incluye_retencion_fuente"
                          checked={editFormData.incluye_retencion_fuente}
                          onChange={handleEditFormChange}
                        />
                        Retención de fuente (3%)
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="incluye_retencion_iva"
                          checked={editFormData.incluye_retencion_iva}
                          onChange={handleEditFormChange}
                          disabled={!editFormData.incluye_iva}
                        />
                        Retención de IVA (70% del IVA)
                      </label>
                    </div>
                  </div>

                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-primary" disabled={isUpdatingFactura}>
                      {isUpdatingFactura ? <><span className="spinner spinner--sm" />Guardando…</> : 'Guardar cambios'}
                    </button>
                    <button type="button" className="btn btn-modal-clear" onClick={closeEditFacturaModal} disabled={isUpdatingFactura}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* CLIENTES REPORT CONFIRM MODAL */}
          {/* ============================================ */}
          {showClientesReporteConfirm && (
            <div className="modal-overlay" onClick={() => setShowClientesReporteConfirm(false)}>
              <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Generar Reporte de Clientes</h3>
                  <button className="modal-close" onClick={() => setShowClientesReporteConfirm(false)}>×</button>
                </div>
                <div className="report-body">
                  <div className="clientes-report-summary">
                    <div className="clientes-report-summary-row">
                      <span className="clientes-report-summary-label">Clientes registrados</span>
                      <span className="clientes-report-summary-value">{clientes.length}</span>
                    </div>
                    <p className="clientes-report-summary-note">
                      Se exportará el listado completo de clientes en formato Excel.
                    </p>
                  </div>
                  <div className="report-actions">
                    <button type="button" className="ff-clear-btn" onClick={() => setShowClientesReporteConfirm(false)}>
                      Cancelar
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleExportClientesExcel} disabled={isExportingClientes}>
                      {isExportingClientes ? <><span className="spinner spinner--sm" />Generando…</> : 'Exportar reporte'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* REPORT MODAL */}
          {/* ============================================ */}
          {/* ============================================ */}
          {/* PAGOS REPORT MODAL */}
          {/* ============================================ */}
          {showPagosReporteModal && (
            <div className="modal-overlay" onClick={() => setShowPagosReporteModal(false)}>
              <div className="modal report-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Generar Reporte de Pagos</h3>
                  <button className="modal-close" onClick={() => setShowPagosReporteModal(false)}>×</button>
                </div>
                <div className="report-body">
                  <div className="ff-filter-card report-filters-inner pagos-report-filters">
                    <div className="ff-date-field">
                      <span className="ff-date-label">Desde</span>
                      <input type="date" name="fechaInicio" value={pagosReportFilters.fechaInicio} onChange={handlePagosReportFilterChange} />
                    </div>
                    <div className="ff-date-field">
                      <span className="ff-date-label">Hasta</span>
                      <input type="date" name="fechaFin" value={pagosReportFilters.fechaFin} onChange={handlePagosReportFilterChange} />
                    </div>
                    <div className="ff-state">
                      <span className="ff-state-label">Método</span>
                      <select name="metodoPago" value={pagosReportFilters.metodoPago} onChange={handlePagosReportFilterChange}>
                        <option value="">Todos</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="cheque">Cheque</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div className="report-actions">
                    <button
                      className="ff-clear-btn"
                      type="button"
                      onClick={() => setPagosReportFilters({ fechaInicio: '', fechaFin: '', metodoPago: '' })}
                    >Limpiar</button>
                    <button className="btn btn-primary btn-sm" onClick={handleExportPagosExcel} disabled={isExportingPagos}>
                      {isExportingPagos ? <><span className="spinner spinner--sm" />Generando…</> : 'Exportar reporte'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showReporteModal && (
            <div className="modal-overlay" onClick={() => setShowReporteModal(false)}>
              <div className="modal report-modal" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                  <h3>Generar Reporte</h3>
                  <button className="modal-close" onClick={() => setShowReporteModal(false)}>×</button>
                </div>

                <div className="report-body">
                  <div className="ff-filter-card report-filters-inner">
                    <div className="ff-controls">
                      <div className="ff-dates">
                        <div className="ff-date-field">
                          <span className="ff-date-label">Desde</span>
                          <input type="date" name="fechaInicio" value={reportFilters.fechaInicio} onChange={handleReportFilterChange} />
                        </div>
                        <div className="ff-date-field">
                          <span className="ff-date-label">Hasta</span>
                          <input type="date" name="fechaFin" value={reportFilters.fechaFin} onChange={handleReportFilterChange} />
                        </div>
                      </div>
                      <div className="ff-pills">
                        <button
                          type="button"
                          className={`ff-pill${reportFilters.soloDeudores ? ' active' : ''}`}
                          onClick={() => setReportFilters(prev => ({ ...prev, soloDeudores: !prev.soloDeudores }))}
                        >Solo con saldo</button>
                        <button
                          type="button"
                          className={`ff-pill${reportFilters.agruparCliente ? ' active' : ''}`}
                          onClick={() => setReportFilters(prev => ({ ...prev, agruparCliente: !prev.agruparCliente }))}
                        >Agrupar por cliente</button>
                      </div>
                    </div>
                  </div>
                  <div className="report-actions">
                    <button
                      className="ff-clear-btn"
                      type="button"
                      onClick={() => setReportFilters({ fechaInicio: '', fechaFin: '', soloDeudores: false, agruparCliente: false })}
                    >Limpiar</button>
                    <button className="btn btn-primary btn-sm" onClick={handleExportExcel} disabled={isExportingReporte}>
                      {isExportingReporte ? <><span className="spinner spinner--sm" />Generando…</> : 'Exportar reporte'}
                    </button>
                  </div>
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
