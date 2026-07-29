const PersonalPageHeader = ({ canCreate, canExport, onBack, onCreate, onExport, onRefresh }) => (
  <header className="page-header">
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
      <h1>Personal</h1>
    </div>
    <div className="page-header-actions">
      {canCreate ? (
        <button className="btn btn-ghost btn-sm" onClick={onCreate} type="button">
          Crear nuevo colaborador
        </button>
      ) : null}
      {canExport ? (
        <button className="btn btn-ghost btn-sm" onClick={onExport} type="button">
          Generar reporte de Personal
        </button>
      ) : null}
      <button
        className="btn btn-ghost btn-sm btn-icon-only"
        onClick={onRefresh}
        title="Actualizar datos"
        type="button"
      >
        ↻
      </button>
    </div>
  </header>
);

export default PersonalPageHeader;
