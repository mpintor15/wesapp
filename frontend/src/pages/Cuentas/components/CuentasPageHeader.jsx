import PageHeader from '../../../components/PageHeader';

const CuentasPageHeader = ({
  activeTab,
  canCreateFactura,
  canCreatePago,
  canExportReportes,
  onBack,
  onCreateFactura,
  onShowFacturasReport,
  onRefreshFacturas,
  onOpenBatchPayment,
  onShowPagosReport,
  onRefreshPagos,
}) => {
  const isFacturas = activeTab === 'facturas';
  const isPagos = activeTab === 'pagos';
  const onRefresh = isFacturas ? onRefreshFacturas : isPagos ? onRefreshPagos : null;

  return (
    <PageHeader
      title="Cuentas"
      onBack={onBack}
      backTitle="Volver al Dashboard"
      onRefresh={onRefresh}
      actions={
        isFacturas ? (
          <>
            {canCreateFactura ? (
              <button className="btn btn-ghost btn-sm" onClick={onCreateFactura} type="button">
                Crear nueva factura
              </button>
            ) : null}
            {canExportReportes ? (
              <button className="btn btn-ghost btn-sm" onClick={onShowFacturasReport} type="button">
                Generar reporte de Facturas
              </button>
            ) : null}
          </>
        ) : isPagos ? (
          <>
            {canCreatePago ? (
              <button className="btn btn-ghost btn-sm" onClick={onOpenBatchPayment} type="button">
                Registrar pago
              </button>
            ) : null}
            {canExportReportes ? (
              <button className="btn btn-ghost btn-sm" onClick={onShowPagosReport} type="button">
                Generar reporte de Pagos
              </button>
            ) : null}
          </>
        ) : null
      }
    />
  );
};

export default CuentasPageHeader;
