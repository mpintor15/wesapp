const PaginationControls = ({ page, totalPages, onPageChange }) => {
  const normalizedTotalPages = Math.max(1, Number(totalPages) || 0);
  const normalizedPage = Math.min(Math.max(1, Number(page) || 1), normalizedTotalPages);

  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPageChange((current) => Math.max(1, current - 1))}
        disabled={normalizedPage <= 1}
        type="button"
      >
        ‹ Anterior
      </button>
      <span className="pagination-info" aria-live="polite">
        Página <span className="pagination-count">{normalizedPage}</span> de {normalizedTotalPages}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPageChange((current) => Math.min(normalizedTotalPages, current + 1))}
        disabled={normalizedPage >= normalizedTotalPages}
        type="button"
      >
        Siguiente ›
      </button>
    </nav>
  );
};

export default PaginationControls;
