import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import { useToast } from '../../context/ToastContext';
import ClientesTab from './components/ClientesTab';
import CuentasModals from './components/CuentasModals';
import CuentasPageHeader from './components/CuentasPageHeader';
import { CuentasErrorBanner, CuentasLoading } from './components/CuentasStatus';
import CuentasTabs from './components/CuentasTabs';
import FacturasTab from './components/FacturasTab';
import PagosTab from './components/PagosTab';
import useBatchPaymentState from './hooks/useBatchPaymentState';
import useBatchPaymentSubmission from './hooks/useBatchPaymentSubmission';
import useCuentasAdministrativeActions from './hooks/useCuentasAdministrativeActions';
import useCuentasData from './hooks/useCuentasData';
import useCuentasPermissions from './hooks/useCuentasPermissions';
import useCuentasReports from './hooks/useCuentasReports';
import useFacturaEditing from './hooks/useFacturaEditing';
import useFacturaForm from './hooks/useFacturaForm';
import useFacturasTableState from './hooks/useFacturasTableState';
import usePagosTableState from './hooks/usePagosTableState';
import './Cuentas.css';

const Cuentas = () => {
  useScrollToTopOnMount();

  const navigate = useNavigate();
  const { showToast } = useToast();
  const permissions = useCuentasPermissions();
  const { isSubmitting: isCreatingFactura, withSubmit: withFacturaSubmit } = useSubmitState();
  const [activeTab, setActiveTab] = useState('facturas');
  const [showClienteForm, setShowClienteForm] = useState(false);

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
  } = useCuentasData({ showToast });

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

  const facturaForm = useFacturaForm({
    clientes,
    reporte,
    canCreateFactura: permissions.canCreateFactura,
    showToast,
    onCreated: refreshFinancialData,
  });
  const facturaFormModal = {
    ...facturaForm,
    handleSubmit: withFacturaSubmit(facturaForm.handleCreateFactura),
  };

  const facturaEditing = useFacturaEditing({
    canEditFactura: permissions.canEditFactura,
    showToast,
    onUpdated: refreshFinancialData,
  });
  const facturasTable = useFacturasTableState(reporte);
  const pagosTable = usePagosTableState(pagos);
  const batchPayment = useBatchPaymentState({ clientes, reporte });
  const batchPaymentSubmission = useBatchPaymentSubmission({
    batchPayment,
    showToast,
    onCreated: refreshFinancialData,
  });
  const reports = useCuentasReports({ showToast });
  const administrativeActions = useCuentasAdministrativeActions({
    permissions,
    showToast,
    onRefresh: refreshFinancialData,
  });

  const openCreateFacturaModal = useCallback(async () => {
    if (!permissions.canCreateFactura) {
      showToast('Solo un usuario Gerente puede crear facturas', 'error');
      return;
    }
    if (!clientesLoaded && !(await loadClientes())) return;
    facturaForm.open();
  }, [clientesLoaded, facturaForm, loadClientes, permissions.canCreateFactura, showToast]);

  const openBatchPaymentModal = useCallback(async () => {
    if (!clientesLoaded && !(await loadClientes())) return;
    batchPayment.open();
  }, [batchPayment, clientesLoaded, loadClientes]);

  return (
    <div className="cuentas-container">
      <CuentasPageHeader
        activeTab={activeTab}
        canCreateFactura={permissions.canCreateFactura}
        showClienteForm={showClienteForm}
        onBack={() => navigate('/')}
        onCreateFactura={openCreateFacturaModal}
        onShowFacturasReport={reports.facturas.open}
        onRefreshFacturas={loadReporte}
        onOpenBatchPayment={openBatchPaymentModal}
        onShowPagosReport={reports.pagos.open}
        onRefreshPagos={loadPagos}
        onToggleClienteForm={() => setShowClienteForm(!showClienteForm)}
        onShowClientesReport={reports.clientes.open}
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
              filtersDraft={facturasTable.filtersDraft}
              filters={facturasTable.filters}
              rows={facturasTable.rows}
              filteredCount={facturasTable.filteredRows.length}
              sort={facturasTable.sort}
              currentPage={facturasTable.currentPage}
              totalPages={facturasTable.totalPages}
              totals={facturasTable.totals}
              canManageFacturas={permissions.canEditFactura}
              onFilterChange={facturasTable.handleFilterChange}
              onApplyFilters={facturasTable.applyFilters}
              onClearFilters={facturasTable.clearFilters}
              onToggleFilter={facturasTable.toggleFilter}
              onSort={facturasTable.handleSort}
              onShowAnulacion={administrativeActions.setAnulacionModal}
              onEdit={facturaEditing.open}
              onCancel={administrativeActions.openCancelFacturaModal}
              onDelete={administrativeActions.requestDeleteFactura}
              onPageChange={facturasTable.setCurrentPage}
            />
          )}

          {activeTab === 'pagos' && (
            <PagosTab
              filtersDraft={pagosTable.filtersDraft}
              filters={pagosTable.filters}
              rows={pagosTable.rows}
              filteredCount={pagosTable.filteredRows.length}
              loading={pagosLoading}
              sort={pagosTable.sort}
              currentPage={pagosTable.currentPage}
              totalPages={pagosTable.totalPages}
              canDeletePago={permissions.canDeletePago}
              onFilterChange={pagosTable.handleFilterChange}
              onApplyFilters={pagosTable.applyFilters}
              onClearFilters={pagosTable.clearFilters}
              onToggleFilter={pagosTable.toggleFilter}
              onSort={pagosTable.handleSort}
              onOpenDetail={administrativeActions.openPagoDetailModal}
              onDelete={administrativeActions.requestDeletePago}
              onPageChange={pagosTable.setCurrentPage}
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

          <CuentasModals
            clientesCount={clientes.length}
            facturaForm={facturaFormModal}
            facturaEditing={facturaEditing}
            batchPayment={batchPayment}
            batchPaymentSubmission={batchPaymentSubmission}
            administrativeActions={administrativeActions}
            reports={reports}
            isCreatingFactura={isCreatingFactura}
            canEditFactura={permissions.canEditFactura}
          />
        </>
      )}
    </div>
  );
};

export default Cuentas;
