import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSubmitState from '../../hooks/useSubmitState';
import useScrollToTopOnMount from '../../hooks/useScrollToTopOnMount';
import { useToast } from '../../context/ToastContext';
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
  const [pagosSelectionResetKey, setPagosSelectionResetKey] = useState(0);

  const {
    clientes,
    reporte,
    facturasCatalogo,
    pagos,
    reportePagination,
    pagosPagination,
    loading,
    clientesLoaded,
    pagosLoading,
    loadError,
    loadClientes,
    loadPagos,
    loadReporte,
    refreshFinancialData,
  } = useCuentasData({ showToast });

  const facturasTable = useFacturasTableState(reporte, reportePagination);
  const pagosTable = usePagosTableState(pagos, pagosPagination);

  const refreshActiveTab = useCallback(() => {
    if (activeTab === 'pagos') return loadPagos(pagosTable.params);
    return loadReporte(facturasTable.params);
  }, [activeTab, facturasTable.params, loadPagos, loadReporte, pagosTable.params]);

  const facturaForm = useFacturaForm({
    clientes,
    reporte: facturasCatalogo,
    canCreateFactura: permissions.canCreateFactura,
    showToast,
    onCreated: () => refreshFinancialData(facturasTable.params, pagosTable.params),
  });
  const facturaFormModal = {
    ...facturaForm,
    handleSubmit: withFacturaSubmit(facturaForm.handleCreateFactura),
  };

  const facturaEditing = useFacturaEditing({
    canEditFactura: permissions.canEditFactura,
    showToast,
    onUpdated: () => refreshFinancialData(facturasTable.params, pagosTable.params),
  });
  const batchPayment = useBatchPaymentState({ clientes, reporte: facturasCatalogo });
  const batchPaymentSubmission = useBatchPaymentSubmission({
    batchPayment,
    showToast,
    onCreated: () => refreshFinancialData(facturasTable.params, pagosTable.params),
  });
  const reports = useCuentasReports({
    canExportReportes: permissions.canExportReportes,
    showToast,
  });
  const administrativeActions = useCuentasAdministrativeActions({
    permissions,
    showToast,
    onRefresh: () => refreshFinancialData(facturasTable.params, pagosTable.params),
  });

  useEffect(() => {
    loadReporte(facturasTable.params);
  }, [facturasTable.params, loadReporte]);

  // Loads on mount (with the default filters already baked into
  // pagosTable.params) so the Pagos tab badge/count is correct from the
  // start, then re-fetches whenever filters/pagination change — same
  // pattern as the facturas effect above.
  useEffect(() => {
    loadPagos(pagosTable.params);
  }, [loadPagos, pagosTable.params]);

  const openCreateFacturaModal = useCallback(async () => {
    if (!permissions.canCreateFactura) {
      showToast('Solo un usuario Gerente puede crear facturas', 'error');
      return;
    }
    if (!clientesLoaded && !(await loadClientes())) return;
    facturaForm.open();
  }, [clientesLoaded, facturaForm, loadClientes, permissions.canCreateFactura, showToast]);

  const openBatchPaymentModal = useCallback(async () => {
    if (!permissions.canCreatePago) {
      showToast('No tienes permisos para registrar pagos', 'error');
      return;
    }
    if (!clientesLoaded && !(await loadClientes())) return;
    batchPayment.open();
  }, [batchPayment, clientesLoaded, loadClientes, permissions.canCreatePago, showToast]);

  return (
    <div className="cuentas-container tabular-page">
      <CuentasPageHeader
        activeTab={activeTab}
        canCreateFactura={permissions.canCreateFactura}
        canCreatePago={permissions.canCreatePago}
        canExportReportes={permissions.canExportReportes}
        onBack={() => navigate('/')}
        onCreateFactura={openCreateFacturaModal}
        onShowFacturasReport={reports.facturas.open}
        onRefreshFacturas={() => loadReporte(facturasTable.params)}
        onOpenBatchPayment={openBatchPaymentModal}
        onShowPagosReport={reports.pagos.open}
        onRefreshPagos={() => {
          setPagosSelectionResetKey((key) => key + 1);
          loadPagos(pagosTable.params);
        }}
      />

      {loading && facturasTable.rows.length === 0 ? (
        <CuentasLoading message="Cargando datos…" />
      ) : (
        <>
          <CuentasErrorBanner message={loadError} onRetry={refreshActiveTab} />
          <CuentasTabs
            activeTab={activeTab}
            counts={{
              facturas: facturasTable.totalItems,
              pagos: pagosTable.totalItems,
            }}
            onChange={setActiveTab}
          />

          {activeTab === 'facturas' && (
            <FacturasTab
              loading={loading}
              filtersDraft={facturasTable.filtersDraft}
              filters={facturasTable.filters}
              rows={facturasTable.rows}
              filteredCount={facturasTable.totalItems}
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
              onPageChange={facturasTable.setCurrentPage}
            />
          )}

          {activeTab === 'pagos' && (
            <PagosTab
              filtersDraft={pagosTable.filtersDraft}
              filters={pagosTable.filters}
              rows={pagosTable.rows}
              filteredCount={pagosTable.totalItems}
              loading={pagosLoading}
              sort={pagosTable.sort}
              currentPage={pagosTable.currentPage}
              totalPages={pagosTable.totalPages}
              selectionResetKey={pagosSelectionResetKey}
              onFilterChange={pagosTable.handleFilterChange}
              onApplyFilters={pagosTable.applyFilters}
              onClearFilters={pagosTable.clearFilters}
              onToggleFilter={pagosTable.toggleFilter}
              onSort={pagosTable.handleSort}
              onPageChange={pagosTable.setCurrentPage}
            />
          )}

          <CuentasModals
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
