import React, { useCallback, useEffect, useState } from 'react';
import AppModal from '../../../components/AppModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useToast } from '../../../context/ToastContext';
import clientesService from '../../../services/clientesService';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';

const MIN_USUARIO_LENGTH = 3;
const MAX_USUARIO_LENGTH = 50;

export const buildClienteInvitationMessage = (clienteNombre, usuario, tempPassword) => {
  const url = globalThis.location.origin;
  return `Hola, te damos la bienvenida al portal de visitas de WES Security para ${clienteNombre}.

A continuación tus datos de acceso:

  Usuario: ${usuario}
  Contraseña temporal: ${tempPassword}

Enlace de ingreso:
  ${url}

Pasos para entrar:
1. Abre el enlace desde cualquier dispositivo o computador.
2. Ingresa tu usuario y contraseña temporal.
3. Al iniciar sesión por primera vez, el sistema te pedirá crear tu propia contraseña segura.

Nota: la contraseña temporal es de un solo uso. Cámbiala en tu primer ingreso.`;
};

const AccesoPortalModal = ({ cliente, canCreate = false, canManage = false, onClose }) => {
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usuarioInput, setUsuarioInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await clientesService.getAccesoPortal(cliente.id);
    if (result.success) {
      setStatus(result.data);
    } else {
      setError(getVisibleErrorMessage(result, 'No se pudo cargar el acceso del cliente.'));
    }
    setLoading(false);
  }, [cliente.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (request, onSuccess, fallbackMessage) => {
    setIsSubmitting(true);
    setError('');
    const result = await request();
    setIsSubmitting(false);
    if (!result.success) {
      setError(getVisibleErrorMessage(result, fallbackMessage));
      return false;
    }
    await onSuccess(result);
    return true;
  };

  const trimmedUsuario = usuarioInput.trim();
  const usuarioInvalid =
    trimmedUsuario.length < MIN_USUARIO_LENGTH || trimmedUsuario.length > MAX_USUARIO_LENGTH;

  const handleCreate = async (event) => {
    event.preventDefault();
    if (usuarioInvalid || isSubmitting) return;
    await run(
      () => clientesService.createAccesoPortal(cliente.id, trimmedUsuario),
      async (result) => {
        setCredentials({ usuario: result.data.usuario, temp_password: result.data.temp_password });
        setUsuarioInput('');
        await load();
      },
      'No se pudo crear el acceso.'
    );
  };

  const handleToggleActivo = async () => {
    const next = !status.usuario.activo;
    await run(
      () => clientesService.setAccesoPortalActivo(cliente.id, next),
      async () => {
        showToast(next ? 'Acceso activado.' : 'Acceso desactivado.', 'success');
        await load();
      },
      'No se pudo actualizar el acceso.'
    );
  };

  const handleConfirm = async () => {
    const action = confirmAction;
    if (action === 'reset') {
      await run(
        () => clientesService.resetAccesoPortal(cliente.id),
        async (result) => {
          setCredentials({
            usuario: result.data.usuario,
            temp_password: result.data.temp_password,
          });
          await load();
        },
        'No se pudo restablecer la contraseña.'
      );
    } else if (action === 'delete') {
      await run(
        () => clientesService.deleteAccesoPortal(cliente.id),
        async () => {
          showToast('Acceso eliminado.', 'success');
          setCredentials(null);
          await load();
        },
        'No se pudo eliminar el acceso.'
      );
    }
    setConfirmAction(null);
  };

  const invitation = credentials
    ? buildClienteInvitationMessage(cliente.nombre, credentials.usuario, credentials.temp_password)
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invitation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('No se pudo copiar. Copia el mensaje manualmente.', 'error');
    }
  };

  const usuario = status?.usuario;

  return (
    <>
      <AppModal
        isOpen
        onClose={onClose}
        closeOnBackdrop={!isSubmitting}
        closeOnEscape={!isSubmitting && !confirmAction}
        title={`Acceso al portal — ${cliente.nombre}`}
        size="md"
        className="configuracion-acceso-portal-modal"
        closeButtonDisabled={isSubmitting}
      >
        <AppModal.Header />
        <AppModal.Body aria-busy={loading || isSubmitting}>
          {error && <div className="error-message">{error}</div>}

          {loading && !status ? (
            <p>Cargando…</p>
          ) : credentials ? (
            <>
              <p className="invitation-intro">
                Copia este mensaje y envíaselo al cliente. La contraseña temporal solo se muestra
                ahora.
              </p>
              <pre className="invitation-message">{invitation}</pre>
            </>
          ) : status && !status.elegible ? (
            <p>
              Este cliente no tiene ubicaciones de tipo urbanización, por lo que no puede tener
              acceso al portal de visitas.
            </p>
          ) : usuario ? (
            <>
              <p>
                El cliente puede consultar, en solo lectura, las visitas de sus urbanizaciones (
                {status.urbanizaciones}).
              </p>
              <dl className="record-card-details">
                <div>
                  <dt>Usuario</dt>
                  <dd>{usuario.usuario}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    {!usuario.activo
                      ? 'Desactivado'
                      : usuario.primer_login
                        ? 'Pendiente de primer ingreso'
                        : 'Activo'}
                  </dd>
                </div>
              </dl>
            </>
          ) : !canCreate ? (
            <p>Este cliente todavía no tiene acceso al portal de visitas.</p>
          ) : (
            <form id="acceso-portal-form" onSubmit={handleCreate}>
              <p>
                Crea un usuario de solo lectura para que el cliente consulte las visitas de sus
                urbanizaciones ({status?.urbanizaciones ?? 0}).
              </p>
              <div className="form-group">
                <label htmlFor="acceso-portal-usuario">Nombre de usuario</label>
                <input
                  id="acceso-portal-usuario"
                  type="text"
                  value={usuarioInput}
                  maxLength={MAX_USUARIO_LENGTH + 1}
                  onChange={(event) => setUsuarioInput(event.target.value)}
                  disabled={isSubmitting}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </form>
          )}
        </AppModal.Body>
        <AppModal.Footer>
          {credentials ? (
            <>
              <button
                className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                type="button"
                onClick={handleCopy}
              >
                {copied ? 'Copiado' : 'Copiar invitación'}
              </button>
              <button
                className="btn btn-modal-clear"
                type="button"
                onClick={() => {
                  setCredentials(null);
                  setCopied(false);
                }}
              >
                Listo
              </button>
            </>
          ) : usuario && !canManage ? (
            <button className="btn btn-modal-clear" type="button" onClick={onClose}>
              Cerrar
            </button>
          ) : usuario ? (
            <>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleToggleActivo}
                disabled={isSubmitting}
              >
                {usuario.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setConfirmAction('reset')}
                disabled={isSubmitting}
              >
                Restablecer contraseña
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => setConfirmAction('delete')}
                disabled={isSubmitting}
              >
                Eliminar acceso
              </button>
            </>
          ) : status?.elegible && canCreate ? (
            <>
              <button
                className="btn btn-modal-clear"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                form="acceso-portal-form"
                disabled={usuarioInvalid || isSubmitting}
              >
                {isSubmitting ? 'Creando…' : 'Crear acceso'}
              </button>
            </>
          ) : (
            <button className="btn btn-modal-clear" type="button" onClick={onClose}>
              Cerrar
            </button>
          )}
        </AppModal.Footer>
      </AppModal>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmAction === 'delete' ? 'Eliminar acceso' : 'Restablecer contraseña'}
        message={
          confirmAction === 'delete'
            ? 'El cliente perderá el acceso al portal. Podrás crear uno nuevo cuando quieras.'
            : 'Se generará una contraseña temporal nueva y la actual dejará de funcionar.'
        }
        confirmText={confirmAction === 'delete' ? 'Eliminar acceso' : 'Restablecer'}
        processingText="Procesando..."
        cancelText="Cancelar"
        variant={confirmAction === 'delete' ? 'danger' : 'primary'}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
};

export default AccesoPortalModal;
