import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import cuentasService from '../../services/cuentasService';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import AnulacionDetailModal from './components/AnulacionDetailModal';
import BatchPaymentModal from './components/BatchPaymentModal';
import CancelFacturaModal from './components/CancelFacturaModal';
import ClientesReportModal from './components/ClientesReportModal';
import ClientesTab from './components/ClientesTab';
import CreateFacturaModal from './components/CreateFacturaModal';
import CuentasDeleteDialogs from './components/CuentasDeleteDialogs';
import CuentasPageHeader from './components/CuentasPageHeader';
import { CuentasErrorBanner, CuentasLoading } from './components/CuentasStatus';
import CuentasTabs from './components/CuentasTabs';
import EditFacturaModal from './components/EditFacturaModal';
import FacturasReportModal from './components/FacturasReportModal';
import FacturasTab from './components/FacturasTab';
import PagoDetailModal from './components/PagoDetailModal';
import PagosReportModal from './components/PagosReportModal';
import PagosTab from './components/PagosTab';
import useBatchPaymentState from './hooks/useBatchPaymentState';
import useCuentasData from './hooks/useCuentasData';
import useFacturaForm from './hooks/useFacturaForm';
import { validateBatchPaymentForm } from './utils/cuentasBatchPayment';
import {
  calculateFacturaTotals,
  filterAndSortFacturas,
  filterAndSortPagos,
  paginateRows,
} from './utils/cuentasFilters';
import {
  DEFAULT_FACTURA_FILTERS,
  DEFAULT_PAGO_FILTERS,
  PAGOS_ROWS_PER_PAGE,
  ROWS_PER_PAGE,
} from './utils/cuentasState';
import './Cuentas.css';

const Cuentas = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isGerente = user?.tipo_usuario === 'gerente';

  const { isSubmitting: isCreatingFactura, withSubmit: withFacturaSubmit } = useSubmitState();
  const { isSubmitting: isSubmittingBatchPayment, withSubmit: withBatchPaymentSubmit } =
    useSubmitState();
  const { isSubmitting: isSubmittingCancelFactura, withSubmit: withCancelFacturaSubmit } =
    useSubmitState();
  const { isSubmitting: isUpdatingFactura, withSubmit: withUpdateFacturaSubmit } = useSubmitState();
  const { isSubmitting: isExportingReporte, withSubmit: withReporteExportSubmit } =
    useSubmitState();
  const { isSubmitting: isExportingClientes, withSubmit: withClientesExportSubmit } =
    useSubmitState();
  const { isSubmitting: isExportingPagos, withSubmit: withPagosExportSubmit } = useSubmitState();

  const [activeTab, setActiveTab] = useState('facturas');

  const cuentasData = useCuentasData({ showToast });
  const {
    clientes,
    reporte,
    pagos,
    loading,
    clientesLoading,
    clientesLoaded,
    pagosLoading,
    pagosLoaded,
    loadError,
    loadClientes,
    loadPagos,
    loadReporte,
    refreshFinancialData,
  } = cuentasData;

  // Anulacion detail modal
  const [anulacionModal, setAnulacionModal] = useState(null);

  // Batch payment modal (per customer)
  const [showCancelFacturaModal, setShowCancelFacturaModal] = useState(false);
  const [selectedPago, setSelectedPago] = useState(null);
  const [pagoToDelete, setPagoToDelete] = useState(null);
  const [facturaToCancel, setFacturaToCancel] = useState(null);
  const [facturaToDelete, setFacturaToDelete] = useState(null);
  const [cancelDetail, setCancelDetail] = useState('');

  const batchPayment = useBatchPaymentState({ clientes, reporte });

  // Report modal (Facturas)
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [showClientesReporteConfirm, setShowClientesReporteConfirm] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
    soloDeudores: false,
    agruparCliente: false,
  });

  // Report modal (Pagos)
  const [showPagosReporteModal, setShowPagosReporteModal] = useState(false);
  const [pagosReportFilters, setPagosReportFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
    metodoPago: '',
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

  const facturaForm = useFacturaForm({
    clientes,
    reporte,
    isGerente,
    showToast,
    onCreated: refreshFinancialData,
  });

  const refreshActiveTab = useCallback(() => {
    if (activeTab === 'pagos') return loadPagos();
    if (activeTab === 'clientes') return loadClientes();
    return loadReporte();
  }, [activeTab, loadClientes, loadPagos, loadReporte]);

  useEffect(() => {
    if (activeTab === 'pagos' && !pagosLoaded && !pagosLoading) {
      loadPagos();
    }
    if (activeTab === 'clientes' && !clientesLoaded && !clientesLoading) {
      loadClientes();
    }
  }, [
    activeTab,
    clientesLoaded,
    clientesLoading,
    loadClientes,
    loadPagos,
    pagosLoaded,
    pagosLoading,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const openCreateFacturaModal = useCallback(async () => {
    if (!isGerente) {
      showToast('Solo un usuario Gerente puede crear facturas', 'error');
      return;
    }
    if (!clientesLoaded && !(await loadClientes())) return;
    facturaForm.open();
  }, [clientesLoaded, facturaForm, isGerente, loadClientes, showToast]);

  const openEditFacturaModal = useCallback(
    (row) => {
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
        incluye_retencion_iva: !!row.incluye_retencion_iva,
      });
      setEditFacturaErrors({});
      setShowEditFacturaModal(true);
    },
    [isGerente, showToast]
  );

  const closeEditFacturaModal = useCallback(() => {
    setShowEditFacturaModal(false);
    setEditFacturaData(null);
    setEditFormData({});
    setEditFacturaErrors({});
  }, []);

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'incluye_iva' && !checked ? { incluye_retencion_iva: false } : {}),
    }));
    setEditFacturaErrors((prev) => ({ ...prev, [name]: '' }));
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
      incluye_retencion_iva: editFormData.incluye_retencion_iva,
    });

    if (result.success) {
      showToast('Factura actualizada exitosamente', 'success');
      closeEditFacturaModal();
      refreshFinancialData();
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
      refreshFinancialData();
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
      await refreshFinancialData();
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
      detalle_anulacion: cancelDetail.trim(),
    });

    if (result.success) {
      showToast('Factura anulada exitosamente', 'success');
      closeCancelFacturaModal();
      refreshFinancialData();
    } else {
      showToast(result.message, 'error');
    }
  });

  // ============================================
  // BATCH PAYMENT HANDLERS
  // ============================================

  const openBatchPaymentModal = async () => {
    if (!clientesLoaded && !(await loadClientes())) return;
    batchPayment.open();
  };

  const handleBatchPaymentSubmit = withBatchPaymentSubmit(async (e) => {
    e.preventDefault();
    const { errors, selectedAbonos } = validateBatchPaymentForm({
      customer: batchPayment.customer,
      date: batchPayment.date,
      totalCredit: batchPayment.totalCredit,
      notas: batchPayment.notas,
      invoices: batchPayment.invoices,
      selections: batchPayment.selections,
      totalPendiente: batchPayment.totalPendiente,
      remaining: batchPayment.remaining,
    });
    if (Object.keys(errors).length > 0) {
      batchPayment.setErrors(errors);
      const firstError = Object.values(errors)[0];
      showToast(firstError, 'error');
      return;
    }

    const result = await cuentasService.createBatchAbono({
      cliente_id: batchPayment.customer.id,
      fecha: batchPayment.date,
      metodo_pago: batchPayment.metodoPago,
      notas: batchPayment.notas.trim() || null,
      abonos: selectedAbonos,
    });

    if (result.success) {
      showToast(result.message || 'Pagos registrados exitosamente', 'success');
      batchPayment.close();
      await refreshFinancialData();
    } else {
      showToast(result.message, 'error');
    }
  });

  // ============================================
  // FACTURAS TABLE FILTERING
  // ============================================

  const filteredFacturas = useMemo(
    () => filterAndSortFacturas(reporte, facturaFilters, facturaTableSort),
    [facturaFilters, facturaTableSort, reporte]
  );

  const totalPages = Math.max(1, Math.ceil(filteredFacturas.length / ROWS_PER_PAGE));
  const paginatedFacturas = paginateRows(filteredFacturas, currentPage, ROWS_PER_PAGE);

  const filteredPagos = useMemo(
    () => filterAndSortPagos(pagos, pagoFilters, pagoTableSort),
    [pagoFilters, pagoTableSort, pagos]
  );

  const pagosTotalPages = Math.max(1, Math.ceil(filteredPagos.length / PAGOS_ROWS_PER_PAGE));
  const paginatedPagos = paginateRows(filteredPagos, pagosCurrentPage, PAGOS_ROWS_PER_PAGE);

  useEffect(() => {
    setPagosCurrentPage((page) => Math.min(page, pagosTotalPages));
  }, [pagosTotalPages]);

  const handleFacturaTableSort = (field) => {
    setFacturaTableSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const handlePagoTableSort = (field) => {
    setPagoTableSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: field === 'fecha' ? 'desc' : 'asc' };
    });
  };

  const handleFacturaFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFacturaFiltersDraft((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleFacturaFilter = (field) => {
    setFacturaFiltersDraft((prev) => ({ ...prev, [field]: !prev[field] }));
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
    setPagoFiltersDraft((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const togglePagoFilter = (field) => {
    setPagoFiltersDraft((prev) => ({ ...prev, [field]: !prev[field] }));
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
    setReportFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
    setPagosReportFilters((prev) => ({ ...prev, [name]: value }));
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
  // SUMMARY TOTALS
  // ============================================

  const totals = calculateFacturaTotals(filteredFacturas);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="cuentas-container">
      <CuentasPageHeader
        activeTab={activeTab}
        isGerente={isGerente}
        showClienteForm={showClienteForm}
        onBack={() => navigate('/')}
        onCreateFactura={openCreateFacturaModal}
        onShowFacturasReport={() => setShowReporteModal(true)}
        onRefreshFacturas={loadReporte}
        onOpenBatchPayment={openBatchPaymentModal}
        onShowPagosReport={() => setShowPagosReporteModal(true)}
        onRefreshPagos={loadPagos}
        onToggleClienteForm={() => setShowClienteForm(!showClienteForm)}
        onShowClientesReport={() => setShowClientesReporteConfirm(true)}
        onRefreshClientes={loadClientes}
      />

      {loading ? (
        <CuentasLoading message="Cargando datos…" />
      ) : (
        <>
          <CuentasErrorBanner message={loadError} onRetry={refreshActiveTab} />
          <CuentasTabs
            activeTab={activeTab}
            counts={{ facturas: reporte.length, pagos: pagos.length, clientes: clientes.length }}
            onChange={setActiveTab}
          />

          {activeTab === 'facturas' && (
            <FacturasTab
              filtersDraft={facturaFiltersDraft}
              filters={facturaFilters}
              rows={paginatedFacturas}
              filteredCount={filteredFacturas.length}
              sort={facturaTableSort}
              currentPage={currentPage}
              totalPages={totalPages}
              totals={totals}
              isGerente={isGerente}
              onFilterChange={handleFacturaFilterChange}
              onApplyFilters={applyFacturaFiltersAndReset}
              onClearFilters={clearFacturaFilters}
              onToggleFilter={toggleFacturaFilter}
              onSort={handleFacturaTableSort}
              onShowAnulacion={setAnulacionModal}
              onEdit={openEditFacturaModal}
              onCancel={openCancelFacturaModal}
              onDelete={requestDeleteFactura}
              onPageChange={setCurrentPage}
            />
          )}

          {activeTab === 'pagos' && (
            <PagosTab
              filtersDraft={pagoFiltersDraft}
              filters={pagoFilters}
              rows={paginatedPagos}
              filteredCount={filteredPagos.length}
              loading={pagosLoading}
              sort={pagoTableSort}
              currentPage={pagosCurrentPage}
              totalPages={pagosTotalPages}
              isGerente={isGerente}
              onFilterChange={handlePagoFilterChange}
              onApplyFilters={applyPagoFilters}
              onClearFilters={clearPagoFilters}
              onToggleFilter={togglePagoFilter}
              onSort={handlePagoTableSort}
              onOpenDetail={openPagoDetailModal}
              onDelete={setPagoToDelete}
              onPageChange={setPagosCurrentPage}
            />
          )}

          {activeTab === 'clientes' && (
            <ClientesTab
              clientes={clientes}
              loading={clientesLoading}
              onClienteCreated={loadClientes}
              onClienteDeleted={loadClientes}
              showClienteForm={showClienteForm}
              setShowClienteForm={setShowClienteForm}
            />
          )}

          {/* ============================================ */}
          {/* PAGO DETAIL MODAL */}
          {/* ============================================ */}
          <PagoDetailModal pago={selectedPago} onClose={closePagoDetailModal} />

          <CuentasDeleteDialogs
            pagoToDelete={pagoToDelete}
            facturaToDelete={facturaToDelete}
            onConfirmPago={handleDeletePagoConfirmed}
            onCancelPago={() => setPagoToDelete(null)}
            onConfirmFactura={handleDeleteFacturaConfirmed}
            onCancelFactura={() => setFacturaToDelete(null)}
          />

          <CreateFacturaModal
            isOpen={facturaForm.isOpen}
            formData={facturaForm.formData}
            facturaErrors={facturaForm.facturaErrors}
            numFacturaError={facturaForm.numFacturaError}
            clienteSearch={facturaForm.clienteSearch}
            showClienteDropdown={facturaForm.showClienteDropdown}
            filteredClientes={facturaForm.filteredClientes}
            selectedCliente={facturaForm.selectedCliente}
            shouldShowCalculation={facturaForm.showFacturaCalculation}
            preview={facturaForm.facturaPreview}
            isSubmitting={isCreatingFactura}
            onFormChange={facturaForm.handleFormChange}
            onClienteSearchChange={facturaForm.handleClienteSearchChange}
            onClienteFocus={() => facturaForm.setShowClienteDropdown(true)}
            onClienteSelect={facturaForm.handleClienteSelect}
            onFlushNumericInputs={facturaForm.flushFacturaNumericInputs}
            onSubmit={withFacturaSubmit(facturaForm.handleCreateFactura)}
            onClose={facturaForm.close}
          />

          <BatchPaymentModal
            isOpen={batchPayment.isOpen}
            totalCredit={batchPayment.totalCredit}
            customerSearch={batchPayment.customerSearch}
            showCustomerDropdown={batchPayment.showDropdown}
            filteredClientes={batchPayment.filteredClientes}
            customer={batchPayment.customer}
            date={batchPayment.date}
            metodoPago={batchPayment.metodoPago}
            notas={batchPayment.notas}
            errors={batchPayment.errors}
            invoices={batchPayment.invoices}
            totalPendiente={batchPayment.totalPendiente}
            selections={batchPayment.selections}
            totalAllocated={batchPayment.totalAllocated}
            remaining={batchPayment.remaining}
            isSubmitting={isSubmittingBatchPayment}
            onTotalCreditChange={batchPayment.handleTotalCreditChange}
            onCustomerSearchChange={batchPayment.handleCustomerSearchChange}
            onCustomerFocus={() => batchPayment.setShowDropdown(true)}
            onCustomerSelect={batchPayment.selectCustomer}
            onDateChange={batchPayment.handleDateChange}
            onMetodoPagoChange={batchPayment.handleMetodoPagoChange}
            onNotasChange={batchPayment.handleNotasChange}
            onAutoDistribute={batchPayment.autoDistributeCurrent}
            onClearSelections={batchPayment.clearSelections}
            onInvoiceToggle={batchPayment.toggleInvoice}
            onPayFull={batchPayment.payFull}
            onAmountChange={batchPayment.changeAmount}
            onSubmit={handleBatchPaymentSubmit}
            onClose={batchPayment.close}
          />

          <CancelFacturaModal
            isOpen={showCancelFacturaModal}
            factura={facturaToCancel}
            detail={cancelDetail}
            isSubmitting={isSubmittingCancelFactura}
            onDetailChange={(e) => setCancelDetail(e.target.value)}
            onSubmit={handleCancelFactura}
            onClose={closeCancelFacturaModal}
          />

          {/* ============================================ */}
          {/* ANULACION DETAIL MODAL */}
          {/* ============================================ */}
          <AnulacionDetailModal factura={anulacionModal} onClose={() => setAnulacionModal(null)} />

          <EditFacturaModal
            isOpen={showEditFacturaModal}
            factura={editFacturaData}
            formData={editFormData}
            errors={editFacturaErrors}
            isGerente={isGerente}
            isSubmitting={isUpdatingFactura}
            onFormChange={handleEditFormChange}
            onSubmit={handleUpdateFactura}
            onClose={closeEditFacturaModal}
          />

          {/* ============================================ */}
          {/* CLIENTES REPORT CONFIRM MODAL */}
          {/* ============================================ */}
          <ClientesReportModal
            isOpen={showClientesReporteConfirm}
            clientesCount={clientes.length}
            isExporting={isExportingClientes}
            onExport={handleExportClientesExcel}
            onClose={() => setShowClientesReporteConfirm(false)}
          />

          <PagosReportModal
            isOpen={showPagosReporteModal}
            filters={pagosReportFilters}
            isExporting={isExportingPagos}
            onFilterChange={handlePagosReportFilterChange}
            onClear={() => setPagosReportFilters({ fechaInicio: '', fechaFin: '', metodoPago: '' })}
            onExport={handleExportPagosExcel}
            onClose={() => setShowPagosReporteModal(false)}
          />

          <FacturasReportModal
            isOpen={showReporteModal}
            filters={reportFilters}
            isExporting={isExportingReporte}
            onFilterChange={handleReportFilterChange}
            onToggleSoloDeudores={() =>
              setReportFilters((prev) => ({ ...prev, soloDeudores: !prev.soloDeudores }))
            }
            onToggleAgruparCliente={() =>
              setReportFilters((prev) => ({ ...prev, agruparCliente: !prev.agruparCliente }))
            }
            onClear={() =>
              setReportFilters({
                fechaInicio: '',
                fechaFin: '',
                soloDeudores: false,
                agruparCliente: false,
              })
            }
            onExport={handleExportExcel}
            onClose={() => setShowReporteModal(false)}
          />
        </>
      )}
    </div>
  );
};

export default Cuentas;
