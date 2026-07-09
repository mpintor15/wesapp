import {
  fullName,
  getStatusKey,
  getStatusLabel,
  getTipoUsuarioLabel,
  isPendingUser,
} from '../utils/usuariosHelpers';

const UsuariosMobileCards = ({ onDelete, onEdit, onInvite, usuarios }) => (
  <div className="records-mobile">
    {usuarios.map((usuario) => (
      <article key={usuario.id} className="record-card">
        <div className="record-card-header">
          <div>
            <h3>{fullName(usuario)}</h3>
            <small className="card-username">@{usuario.usuario}</small>
          </div>
          <span className={`badge badge-${getStatusKey(usuario)}`}>{getStatusLabel(usuario)}</span>
        </div>
        <dl className="record-card-details">
          <div>
            <dt>Tipo</dt>
            <dd>{getTipoUsuarioLabel(usuario.tipo_usuario)}</dd>
          </div>
          <div>
            <dt>Primer acceso</dt>
            <dd>{usuario.primer_login ? 'Pendiente' : 'Completado'}</dd>
          </div>
        </dl>
        <div className="record-card-actions usuarios-card-actions">
          {isPendingUser(usuario) && (
            <button
              className="btn btn-invite btn-sm usuarios-invite-action"
              onClick={() => onInvite(usuario)}
              type="button"
            >
              Reenviar invitación
            </button>
          )}
          <button className="btn btn-neutral btn-sm" onClick={() => onEdit(usuario)} type="button">
            Editar
          </button>
          <button
            className="btn btn-destructive btn-sm"
            onClick={() => onDelete(usuario)}
            type="button"
          >
            Eliminar
          </button>
        </div>
      </article>
    ))}
  </div>
);

export default UsuariosMobileCards;
