const TableSkeleton = ({ message = 'Cargando datos…', rows = 5 }) => (
  <div className="table-skeleton" role="status" aria-live="polite">
    <span className="sr-only">{message}</span>
    {Array.from({ length: rows }, (_, index) => (
      <span className="table-skeleton__row" key={index} aria-hidden="true" />
    ))}
  </div>
);

export default TableSkeleton;
