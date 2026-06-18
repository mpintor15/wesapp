import { buildInvitationMessage } from '../utils/usuariosHelpers';

const UsuarioInvitationModal = ({ copied, invitationData, onClose, onCopy }) => (
  <div className="modal-overlay">
    <div className="modal usuarios-modal usuarios-invitation-modal">
      <div className="modal-header">
        <h3>Usuario creado</h3>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar" type="button">
          ×
        </button>
      </div>
      <div className="modal-body">
        <p className="invitation-intro">
          Copia este mensaje y envíaselo a{' '}
          <strong>
            {invitationData.nombre} {invitationData.apellido}
          </strong>{' '}
          por el canal que prefieras.
        </p>
        <pre className="invitation-message">
          {buildInvitationMessage(
            invitationData.nombre,
            invitationData.apellido,
            invitationData.usuario,
            invitationData.temp_password
          )}
        </pre>
      </div>
      <div className="modal-buttons usuarios-modal-actions">
        <button
          className={`btn ${copied ? 'btn-success' : 'btn-primary'} invitation-copy-btn`}
          type="button"
          onClick={onCopy}
        >
          {copied ? (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copiado
            </>
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copiar invitación
            </>
          )}
        </button>
        <button className="btn btn-modal-clear" type="button" onClick={onClose}>
          Listo
        </button>
      </div>
    </div>
  </div>
);

export default UsuarioInvitationModal;
