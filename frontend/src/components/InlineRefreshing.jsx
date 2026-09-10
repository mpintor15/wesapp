const InlineRefreshing = ({ message = 'Actualizando…' }) => (
  <div className="inline-loading-indicator" role="status" aria-live="polite">
    <span className="spinner spinner--sm" aria-hidden="true" />
    <span>{message}</span>
  </div>
);

export default InlineRefreshing;
