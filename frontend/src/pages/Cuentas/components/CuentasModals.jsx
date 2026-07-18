import AnulacionDetailModal from './AnulacionDetailModal';
import BatchPaymentModal from './BatchPaymentModal';
import CancelFacturaModal from './CancelFacturaModal';
import ClientesReportModal from './ClientesReportModal';
import CreateFacturaModal from './CreateFacturaModal';
import CuentasDeleteDialogs from './CuentasDeleteDialogs';
import EditFacturaModal from './EditFacturaModal';
import FacturasReportModal from './FacturasReportModal';
import PagoDetailModal from './PagoDetailModal';
import PagosReportModal from './PagosReportModal';

const CuentasModals = ({
  clientesCount,
  facturaForm,
  facturaEditing,
  batchPayment,
  batchPaymentSubmission,
  administrativeActions,
  reports,
  isCreatingFactura,
  canEditFactura,
}) => (
  <>
    <PagoDetailModal
      pago={administrativeActions.selectedPago}
      onClose={administrativeActions.closePagoDetailModal}
    />

    <CuentasDeleteDialogs
      pagoToDelete={administrativeActions.pagoToDelete}
      facturaToDelete={administrativeActions.facturaToDelete}
      onConfirmPago={administrativeActions.confirmDeletePago}
      onCancelPago={administrativeActions.cancelDeletePago}
      onConfirmFactura={administrativeActions.confirmDeleteFactura}
      onCancelFactura={administrativeActions.cancelDeleteFactura}
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
      onSubmit={facturaForm.handleSubmit}
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
      isSubmitting={batchPaymentSubmission.isSubmitting}
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
      onSubmit={batchPaymentSubmission.handleSubmit}
      onClose={batchPayment.close}
    />

    <CancelFacturaModal
      isOpen={administrativeActions.showCancelFacturaModal}
      factura={administrativeActions.facturaToCancel}
      detail={administrativeActions.cancelDetail}
      isSubmitting={administrativeActions.isSubmittingCancelFactura}
      onDetailChange={(event) => administrativeActions.setCancelDetail(event.target.value)}
      onSubmit={administrativeActions.confirmCancelFactura}
      onClose={administrativeActions.closeCancelFacturaModal}
    />

    <AnulacionDetailModal
      factura={administrativeActions.anulacionModal}
      onClose={() => administrativeActions.setAnulacionModal(null)}
    />

    <EditFacturaModal
      isOpen={facturaEditing.isOpen}
      factura={facturaEditing.factura}
      formData={facturaEditing.formData}
      errors={facturaEditing.errors}
      canEditFactura={canEditFactura}
      isSubmitting={facturaEditing.isSubmitting}
      onFormChange={facturaEditing.handleFormChange}
      onSubmit={facturaEditing.handleSubmit}
      onClose={facturaEditing.close}
    />

    <ClientesReportModal
      isOpen={reports.clientes.isOpen}
      clientesCount={clientesCount}
      isExporting={reports.clientes.isExporting}
      onExport={reports.clientes.export}
      onClose={reports.clientes.close}
    />

    <PagosReportModal
      isOpen={reports.pagos.isOpen}
      filters={reports.pagos.filters}
      isExporting={reports.pagos.isExporting}
      onFilterChange={reports.pagos.handleFilterChange}
      onClear={reports.pagos.clear}
      onExport={reports.pagos.export}
      onClose={reports.pagos.close}
    />

    <FacturasReportModal
      isOpen={reports.facturas.isOpen}
      filters={reports.facturas.filters}
      isExporting={reports.facturas.isExporting}
      onFilterChange={reports.facturas.handleFilterChange}
      onToggleSoloDeudores={reports.facturas.toggleSoloDeudores}
      onToggleAgruparCliente={reports.facturas.toggleAgruparCliente}
      onClear={reports.facturas.clear}
      onExport={reports.facturas.export}
      onClose={reports.facturas.close}
    />
  </>
);

export default CuentasModals;
