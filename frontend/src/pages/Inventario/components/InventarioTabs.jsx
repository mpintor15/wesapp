const InventarioTabs = ({
  activeTab,
  articulosCount,
  bajasCount,
  movimientosCount,
  onTabChange,
}) => (
  <div className="inventario-tabs">
    <button
      className={`tab ${activeTab === 'articulos' ? 'active' : ''}`}
      onClick={() => onTabChange('articulos')}
      type="button"
    >
      Artículos
      {articulosCount > 0 && <span className="tab-badge">{articulosCount}</span>}
    </button>
    <button
      className={`tab ${activeTab === 'movimientos' ? 'active' : ''}`}
      onClick={() => onTabChange('movimientos')}
      type="button"
    >
      Movimientos
      {movimientosCount > 0 && <span className="tab-badge">{movimientosCount}</span>}
    </button>
    <button
      className={`tab ${activeTab === 'bajas' ? 'active' : ''}`}
      onClick={() => onTabChange('bajas')}
      type="button"
    >
      Dados de baja
      {bajasCount > 0 && <span className="tab-badge">{bajasCount}</span>}
    </button>
  </div>
);

export default InventarioTabs;
