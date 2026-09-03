// Shared loading UI for tables/lists that fetch paginated or filtered data.
//
// Rendering a full-page spinner in place of a table on every filter/page
// change causes a jarring layout jump even when the previous rows are still
// valid to show. This component picks the right visual for each case:
//   - First load (no rows loaded yet): a centered spinner block.
//   - Refetch while rows already exist (filter/page/sort change): a small
//     inline "Actualizando..." indicator above the still-visible rows.
//   - Not loading: renders nothing.
const LoadingState = ({
  loading,
  hasRows,
  message = 'Cargando...',
  refreshMessage = 'Actualizando...',
}) => {
  if (!loading) return null;

  if (!hasRows) {
    return (
      <div className="loading-spinner-wrap">
        <span className="spinner" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="inline-loading-indicator" role="status">
      <span className="spinner spinner--sm" />
      <span>{refreshMessage}</span>
    </div>
  );
};

export default LoadingState;
