const PaginationControls = ({ page, totalPages, onPageChange }) => (
  <nav className="pagination" aria-label="Paginación">
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => onPageChange((current) => Math.max(1, current - 1))}
      disabled={page <= 1}
      type="button"
    >
      ‹ Anterior
    </button>
    <span className="pagination-info" aria-live="polite">
      Página <span className="pagination-count">{page}</span> de {totalPages}
    </span>
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}
      disabled={totalPages === 0 || page >= totalPages}
      type="button"
    >
      Siguiente ›
    </button>
  </nav>
);

export default PaginationControls;
