const CuentasPageHeader = ({
  activeTab,
  canCreateFactura,
  canCreatePago,
  onBack,
  onCreateFactura,
  onShowFacturasReport,
  onRefreshFacturas,
  onOpenBatchPayment,
  onShowPagosReport,
  onRefreshPagos,
}) => (
  <header className="page-header">
    <div className="page-header-left">
      <button className="btn-back" onClick={onBack} title="Volver al Dashboard" type="button">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="14"
          height="14"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver
      </button>
      <h1>Cuentas</h1>
    </div>

    {activeTab === 'facturas' ? (
      <div className="page-header-actions">
        {canCreateFactura ? (
          <button className="btn btn-ghost btn-sm" onClick={onCreateFactura} type="button">
            Crear nueva factura
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm" onClick={onShowFacturasReport} type="button">
          Generar reporte de Facturas
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon-only"
          onClick={onRefreshFacturas}
          title="Actualizar datos"
          type="button"
        >
          ↻
        </button>
      </div>
    ) : null}

    {activeTab === 'pagos' ? (
      <div className="page-header-actions">
        {canCreatePago ? (
          <button className="btn btn-ghost btn-sm" onClick={onOpenBatchPayment} type="button">
            Registrar pago
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm" onClick={onShowPagosReport} type="button">
          Generar reporte de Pagos
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon-only"
          onClick={onRefreshPagos}
          title="Actualizar datos"
          type="button"
        >
          ↻
        </button>
      </div>
    ) : null}
  </header>
);

export default CuentasPageHeader;
