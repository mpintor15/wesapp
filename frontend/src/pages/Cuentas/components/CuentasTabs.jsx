const TABS = [
  { key: 'facturas', label: 'Facturas' },
  { key: 'pagos', label: 'Pagos' },
];

const CuentasTabs = ({ activeTab, counts, onChange }) => (
  <div className="cuentas-tabs">
    {TABS.map((tab) => (
      <button
        key={tab.key}
        className={`tab ${activeTab === tab.key ? 'active' : ''}`}
        onClick={() => onChange(tab.key)}
        type="button"
      >
        {tab.label}
        {counts[tab.key] > 0 && <span className="tab-badge">{counts[tab.key]}</span>}
      </button>
    ))}
  </div>
);

export default CuentasTabs;
