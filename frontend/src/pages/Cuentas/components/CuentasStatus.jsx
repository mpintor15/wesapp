export const CuentasLoading = ({ message }) => (
  <div className="loading-spinner-wrap">
    <span className="spinner" />
    <span>{message}</span>
  </div>
);

export const CuentasErrorBanner = ({ message, onRetry }) => {
  if (!message) return null;

  return (
    <div className="cuentas-error-banner" role="alert">
      <svg
        className="cuentas-error-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
      <button className="btn btn-danger btn-sm" onClick={onRetry} type="button">
        Reintentar
      </button>
    </div>
  );
};
