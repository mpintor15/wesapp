import {
  fullName,
  getStatusKey,
  getStatusLabel,
  getTipoUsuarioLabel,
  isPendingUser,
} from '../utils/usuariosHelpers';

const SortButton = ({ field, label, onSort, tableSort }) => (
  <button type="button" className="th-sort-btn" onClick={() => onSort(field)}>
    {label}
    <span className={`th-sort-indicator${tableSort.field === field ? ' active' : ''}`}>
      {tableSort.field === field && tableSort.direction === 'desc' ? '↓' : '↑'}
    </span>
  </button>
);

const UsuariosTable = ({ onDelete, onEdit, onInvite, onSort, tableSort, usuarios }) => (
  <div className="table-responsive app-table-shell usuarios-table-shell">
    <table className="app-table usuarios-table">
      <thead>
        <tr>
          <th>
            <SortButton
              field="apellido"
              label="Nombre completo"
              onSort={onSort}
              tableSort={tableSort}
            />
          </th>
          <th>
            <SortButton field="usuario" label="Usuario" onSort={onSort} tableSort={tableSort} />
          </th>
          <th>
            <SortButton field="tipo_usuario" label="Tipo" onSort={onSort} tableSort={tableSort} />
          </th>
          <th>Estado</th>
          <th className="center app-col-actions app-col-actions--triple">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {usuarios.length > 0 ? (
          usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td className="cell-fullname">{fullName(usuario)}</td>
              <td className="cell-username">@{usuario.usuario}</td>
              <td>{getTipoUsuarioLabel(usuario.tipo_usuario)}</td>
              <td>
                <span className={`badge badge-${getStatusKey(usuario)}`}>
                  {getStatusLabel(usuario)}
                </span>
              </td>
              <td className="center app-col-actions app-col-actions--triple">
                <div className="action-buttons app-table-actions">
                  <button
                    className="action-btn action-btn-edit"
                    onClick={() => onEdit(usuario)}
                    title="Editar"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z" />
                      <path d="M14.5 5.5l3.5 3.5" />
                    </svg>
                  </button>
                  {isPendingUser(usuario) && (
                    <button
                      className="action-btn action-btn-pdf"
                      onClick={() => onInvite(usuario)}
                      title="Reenviar invitación"
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 4h16v16H4z" />
                        <path d="M4 7l8 6 8-6" />
                      </svg>
                    </button>
                  )}
                  <button
                    className="action-btn action-btn-del"
                    onClick={() => onDelete(usuario)}
                    title="Eliminar"
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
            <td colSpan="5">No hay usuarios registrados</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default UsuariosTable;
