import InlineRefreshing from './InlineRefreshing';
import TableSkeleton from './TableSkeleton';

const LoadingState = ({
  loading,
  hasRows,
  message = 'Cargando...',
  refreshMessage = 'Actualizando...',
}) => {
  if (!loading) return null;

  if (!hasRows) {
    return <TableSkeleton message={message} />;
  }

  return <InlineRefreshing message={refreshMessage} />;
};

export default LoadingState;
