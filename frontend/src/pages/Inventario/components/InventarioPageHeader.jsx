const InventarioPageHeader = ({
  activeTab,
  canCreateArticulo,
  canCreateMovimiento,
  canExport,
  isExportingBajas,
  onBack,
  onCreateArticulo,
  onCreateMovimiento,
  onExportArticulos,
  onExportBajas,
  onExportMovimientos,
  onRefresh,
}) => (
  <header className="brand-header page-header">
    <div className="page-header-left">
      <button className="btn-back" onClick={onBack} type="button">
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
      <h1>Inventario</h1>
    </div>
    <div className="page-header-actions">
      {activeTab === 'articulos' && canCreateArticulo && (
        <button className="btn btn-ghost btn-sm" onClick={onCreateArticulo} type="button">
          Crear artículo
        </button>
      )}
      {activeTab === 'articulos' && canExport && (
        <button className="btn btn-ghost btn-sm" onClick={onExportArticulos} type="button">
          Generar reporte de Inventario
        </button>
      )}
      {activeTab === 'movimientos' && canCreateMovimiento && (
        <button className="btn btn-ghost btn-sm" onClick={onCreateMovimiento} type="button">
          Crear nuevo movimiento
        </button>
      )}
      {activeTab === 'movimientos' && canExport && (
        <button className="btn btn-ghost btn-sm" onClick={onExportMovimientos} type="button">
          Generar reporte de Movimientos
        </button>
      )}
      {activeTab === 'bajas' && canExport && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={onExportBajas}
          disabled={isExportingBajas}
          type="button"
        >
          {isExportingBajas ? 'Generando...' : 'Generar reporte de Dados de baja'}
        </button>
      )}
      <button
        className="btn btn-ghost btn-sm btn-icon-only"
        onClick={onRefresh}
        title="Actualizar datos"
        aria-label="Actualizar datos"
        type="button"
      >
        ↻
      </button>
    </div>
  </header>
);

export default InventarioPageHeader;
