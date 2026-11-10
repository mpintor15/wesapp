import { useCallback, useEffect, useState } from 'react';
import AppModal from '../../../components/AppModal';
import { useToast } from '../../../context/ToastContext';
import useSubmitState from '../../../hooks/useSubmitState';
import usuariosService from '../../../services/usuariosService';
import UsuarioInvitationModal from './UsuarioInvitationModal';
import { buildInvitationMessage, suggestCuentaUsuario } from '../utils/usuariosHelpers';

const EMPTY_FORM = { nombre: '', usuario: '' };

const getEstado = (cuenta) => {
  if (!cuenta.activo) return { className: 'badge-inactive', label: 'Inactiva' };
  if (cuenta.primer_login) return { className: 'badge-pending', label: 'Pendiente' };
  return { className: 'badge-active', label: 'Activa' };
};

// Cuentas de módulo: usuarios monitorista que no pertenecen a un colaborador
// (p. ej. "Módulo 1 Monitoreo"). El backend valida permisos y reglas.
const CuentasModulo = ({
  active = true,
  canEdit,
  refreshKey,
  showCreate,
  onCloseCreate,
  onCountChange,
}) => {
  const { showToast } = useToast();
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [invitation, setInvitation] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // Mientras el usuario no edite el usuario a mano, se sugiere a partir del nombre.
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const { isSubmitting: isCreating, withSubmit } = useSubmitState();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await usuariosService.getCuentasModulo();
    if (res.success) {
      setCuentas(res.data);
      onCountChange?.(res.data.length);
    } else {
      showToast(res.message, 'error');
    }
    setLoading(false);
  }, [showToast, onCountChange]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleCreate = withSubmit(async (event) => {
    event.preventDefault();
    const res = await usuariosService.createCuentaModulo({
      nombre: form.nombre.trim(),
      usuario: form.usuario.trim(),
    });
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    onCloseCreate();
    setForm(EMPTY_FORM);
    setUsuarioEditado(false);
    setInvitation(res.data);
    load();
  });

  const handleToggleActivo = async (cuenta) => {
    setBusyId(cuenta.id);
    const res = await usuariosService.updateCuentaModulo(cuenta.id, { activo: !cuenta.activo });
    setBusyId(null);
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    showToast(cuenta.activo ? 'Cuenta desactivada' : 'Cuenta activada', 'success');
    load();
  };

  const handleReenviar = async (cuenta) => {
    setBusyId(cuenta.id);
    const res = await usuariosService.reenviarInvitacionCuentaModulo(cuenta.id);
    setBusyId(null);
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    setInvitation(res.data);
  };

  const handleCopy = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(
        buildInvitationMessage(
          invitation.nombre,
          invitation.apellido,
          invitation.usuario,
          invitation.temp_password
        )
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('No se pudo copiar. Selecciona el texto manualmente.', 'error');
    }
  };

  useEffect(() => {
    if (!showCreate) {
      setForm(EMPTY_FORM);
      setUsuarioEditado(false);
    }
  }, [showCreate]);

  const handleNombreChange = (event) => {
    const nombre = event.target.value;
    setForm((prev) => ({
      ...prev,
      nombre,
      usuario: usuarioEditado ? prev.usuario : suggestCuentaUsuario(nombre),
    }));
  };

  const handleUsuarioChange = (event) => {
    setUsuarioEditado(true);
    setForm((prev) => ({ ...prev, usuario: event.target.value }));
  };

  return (
    <section
      id="personal-panel-cuentas"
      role="tabpanel"
      aria-labelledby="personal-tab-cuentas"
      className="cuentas-modulo"
      hidden={!active}
    >
      <div className="cuentas-modulo__header">
        <p className="cuentas-modulo__hint">
          Usuarios que no pertenecen a una persona, como las estaciones de monitoreo. Entran con rol
          Jefe de monitoreo y no están vinculados a un colaborador.
        </p>
      </div>

      {loading ? (
        <div className="loading-spinner-wrap">
          <span className="spinner" />
          <span>Cargando cuentas de módulo…</span>
        </div>
      ) : cuentas.length === 0 ? (
        <div className="empty-state">No hay cuentas de módulo registradas.</div>
      ) : (
        <div className="table-wrapper">
          <table className="table cuentas-modulo__table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Estado</th>
                {canEdit ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {cuentas.map((cuenta) => {
                const estado = getEstado(cuenta);
                return (
                  <tr key={cuenta.id}>
                    <td>{[cuenta.nombre, cuenta.apellido].filter(Boolean).join(' ')}</td>
                    <td>@{cuenta.usuario}</td>
                    <td>
                      <span className={`badge ${estado.className}`}>{estado.label}</span>
                    </td>
                    {canEdit ? (
                      <td className="cuentas-modulo__actions">
                        {cuenta.activo ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            disabled={busyId === cuenta.id}
                            onClick={() => handleReenviar(cuenta)}
                          >
                            {cuenta.primer_login ? 'Reenviar invitación' : 'Restablecer contraseña'}
                          </button>
                        ) : null}
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          disabled={busyId === cuenta.id}
                          onClick={() => handleToggleActivo(cuenta)}
                        >
                          {cuenta.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <AppModal
          isOpen
          onClose={() => onCloseCreate()}
          title="Crear cuenta de módulo"
          size="md"
          className="usuarios-modal"
        >
          <AppModal.Header />
          <form onSubmit={handleCreate}>
            <AppModal.Body className="usuarios-form-grid">
              <div className="form-group usuarios-form-grid__full">
                <label htmlFor="cm-nombre">
                  Nombre <span className="required">*</span>
                </label>
                <input
                  id="cm-nombre"
                  value={form.nombre}
                  onChange={handleNombreChange}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group usuarios-form-grid__full">
                <label htmlFor="cm-usuario">
                  Usuario <span className="required">*</span>
                </label>
                <input
                  id="cm-usuario"
                  value={form.usuario}
                  onChange={handleUsuarioChange}
                  autoComplete="off"
                  minLength={3}
                  required
                />
                <span className="field-hint">Sugerido a partir del nombre; puedes cambiarlo.</span>
              </div>
            </AppModal.Body>
            <AppModal.Footer className="usuarios-modal-actions">
              <button className="btn btn-primary" type="submit" disabled={isCreating}>
                {isCreating ? 'Creando…' : 'Crear cuenta'}
              </button>
              <button
                className="btn btn-modal-clear"
                type="button"
                onClick={() => onCloseCreate()}
                disabled={isCreating}
              >
                Cancelar
              </button>
            </AppModal.Footer>
          </form>
        </AppModal>
      )}

      {invitation && (
        <UsuarioInvitationModal
          copied={copied}
          invitationData={invitation}
          onClose={() => {
            setInvitation(null);
            setCopied(false);
          }}
          onCopy={handleCopy}
        />
      )}
    </section>
  );
};

export default CuentasModulo;
