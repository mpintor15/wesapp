import { PAGE_SIZE_OPTIONS } from '../../../utils/pagination';

const PaginationControls = ({ page, pageSize, totalPages, onPageChange, onPageSizeChange }) => (
  <div className="pagination">
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => onPageChange((current) => Math.max(1, current - 1))}
      disabled={page <= 1}
      type="button"
    >
      ‹ Anterior
    </button>
    <span className="pagination-info">
      Página <span className="pagination-count">{page}</span> de {totalPages}
    </span>
    {onPageSizeChange ? (
      <select
        aria-label="Registros por página"
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : null}
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}
      disabled={totalPages === 0 || page >= totalPages}
      type="button"
    >
      Siguiente ›
    </button>
  </div>
);

export default PaginationControls;
