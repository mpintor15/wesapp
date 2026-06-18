const PaginationControls = ({ page, totalPages, onPageChange }) => (
  <div className="pagination">
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => onPageChange((current) => Math.max(1, current - 1))}
      disabled={page === 1}
      type="button"
    >
      ‹ Anterior
    </button>
    <span className="pagination-info">
      Página <span className="pagination-count">{page}</span> de {totalPages}
    </span>
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}
      disabled={page === totalPages}
      type="button"
    >
      Siguiente ›
    </button>
  </div>
);

export default PaginationControls;
