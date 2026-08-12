import PageHeader from '../../../components/PageHeader';

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
  <PageHeader
    title="Inventario"
    onBack={onBack}
    onRefresh={onRefresh}
    actions={
      <>
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
      </>
    }
  />
);

export default InventarioPageHeader;
