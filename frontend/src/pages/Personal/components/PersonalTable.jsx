const SortButton = ({ field, label, onSort, tableSort }) => (
  <button type="button" className="th-sort-btn" onClick={() => onSort(field)}>
    {label}
    <span className={`th-sort-indicator${tableSort.field === field ? ' active' : ''}`}>
      {tableSort.field === field && tableSort.direction === 'desc' ? '↓' : '↑'}
    </span>
  </button>
);

const PersonalTable = ({
  colaboradores,
  currentPage,
  onDelete,
  onEdit,
  onPageChange,
  onSort,
  paginatedColaboradores,
  tableSort,
  totalPages,
}) => (
  <div className="table-responsive app-table-shell personal-table-shell">
    <table className="app-table personal-table">
      <thead>
        <tr>
          <th>
            <SortButton
              field="nombres_completos"
              label="Nombre"
              onSort={onSort}
              tableSort={tableSort}
            />
          </th>
          <th>
            <SortButton field="cedula" label="Cédula" onSort={onSort} tableSort={tableSort} />
          </th>
          <th>
            <SortButton field="cargo" label="Cargo" onSort={onSort} tableSort={tableSort} />
          </th>
          <th>Estado</th>
          <th>Contacto</th>
          <th>Banco / Cuenta</th>
          <th>
            <SortButton field="sueldo" label="Sueldo" onSort={onSort} tableSort={tableSort} />
          </th>
          <th className="center col-actions app-col-actions app-col-actions--double"></th>
        </tr>
      </thead>
      <tbody>
        {colaboradores.length > 0 ? (
          paginatedColaboradores.map((c) => (
            <tr key={c.id}>
              <td className="cell-person-name">{c.nombres_completos}</td>
              <td className="cell-nowrap">{c.cedula}</td>
              <td>{c.cargo}</td>
              <td className="cell-status">
                <span className={`badge badge-${c.estado === 'activo' ? 'active' : 'inactive'}`}>
                  {c.estado}
                </span>
              </td>
              <td className="cell-nowrap">{c.celular || '—'}</td>
              <td>
                <div className="bank-cell">
                  <span>{c.banco || '—'}</span>
                  {c.numero_cuenta ? <small>{c.numero_cuenta}</small> : null}
                </div>
              </td>
              <td className="col-money">
                {c.sueldo ? `$${Number.parseFloat(c.sueldo).toFixed(2)}` : '—'}
              </td>
              <td className="center col-actions app-col-actions app-col-actions--double">
                <div className="action-buttons app-table-actions">
                  <button
                    className="action-btn action-btn-neutral"
                    onClick={() => onEdit(c)}
                    title="Editar"
                    aria-label={`Editar ${c.nombres_completos}`}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z" />
                      <path d="M14.5 5.5l3.5 3.5" />
                    </svg>
                  </button>
                  <button
                    className="action-btn action-btn-destructive"
                    onClick={() => onDelete(c)}
                    title="Eliminar"
                    aria-label={`Eliminar ${c.nombres_completos}`}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))
        ) : (
          <tr className="empty-row">
            <td colSpan="8">No hay colaboradores registrados</td>
          </tr>
        )}
      </tbody>
    </table>
    {totalPages > 1 && (
      <div className="pagination personal-pagination">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onPageChange((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1}
          type="button"
        >
          ‹ Anterior
        </button>
        <span className="pagination-info">
          Página <span className="pagination-count">{currentPage}</span> de {totalPages}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onPageChange((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage === totalPages}
          type="button"
        >
          Siguiente ›
        </button>
      </div>
    )}
  </div>
);

export default PersonalTable;
