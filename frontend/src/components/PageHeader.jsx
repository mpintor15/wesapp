const BackIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="14"
    height="14"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const PageHeader = ({
  title,
  onBack,
  backLabel = 'Volver',
  backTitle,
  actions,
  onRefresh,
  refreshDisabled = false,
  refreshLabel = 'Actualizar datos',
}) => (
  <header className="brand-header page-header page-header--light">
    <div className="page-header-left">
      <button className="btn-back" onClick={onBack} title={backTitle} type="button">
        <BackIcon />
        {backLabel}
      </button>
      <h1>{title}</h1>
    </div>

    {actions || onRefresh ? (
      <div className="page-header-actions">
        {actions}
        {onRefresh ? (
          <button
            className="btn btn-ghost btn-sm btn-icon-only"
            onClick={onRefresh}
            title={refreshLabel}
            aria-label={refreshLabel}
            type="button"
            disabled={refreshDisabled}
          >
            ↻
          </button>
        ) : null}
      </div>
    ) : null}
  </header>
);

export default PageHeader;
