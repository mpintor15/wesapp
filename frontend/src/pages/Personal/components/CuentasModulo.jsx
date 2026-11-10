import { useCallback, useEffect, useState } from 'react';
import AppModal from '../../../components/AppModal';
import TabularWorkspace from '../../../components/TabularWorkspace';
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

      <TabularWorkspace
        dataCard
        summary={
          !loading ? (
            <div className="table-result-count">
              Mostrando {cuentas.length} de {cuentas.length} cuenta(s) de módulo
            </div>
          ) : null
        }
      >
        {loading ? (
          <div className="loading-spinner-wrap">
            <span className="spinner" />
            <span>Cargando cuentas de módulo…</span>
          </div>
        ) : (
          <div className="table-responsive app-table-shell cuentas-modulo__shell">
            <table className="app-table cuentas-modulo__table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Estado</th>
                  {canEdit ? (
                    <th className="center col-actions app-col-actions app-col-actions--double"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {cuentas.length > 0 ? (
                  cuentas.map((cuenta) => {
                    const estado = getEstado(cuenta);
                    const nombre = [cuenta.nombre, cuenta.apellido].filter(Boolean).join(' ');
                    const resetLabel = cuenta.primer_login
                      ? 'Reenviar invitación'
                      : 'Restablecer contraseña';
                    return (
                      <tr key={cuenta.id}>
                        <td className="cell-person-name">{nombre}</td>
                        <td className="cell-nowrap">@{cuenta.usuario}</td>
                        <td className="cell-status">
                          <span className={`badge ${estado.className}`}>{estado.label}</span>
                        </td>
                        {canEdit ? (
                          <td className="center col-actions app-col-actions app-col-actions--double">
                            <div className="action-buttons app-table-actions">
                              {cuenta.activo ? (
                                <button
                                  className="action-btn action-btn-neutral"
                                  type="button"
                                  title={resetLabel}
                                  aria-label={`${resetLabel} de ${nombre}`}
                                  disabled={busyId === cuenta.id}
                                  onClick={() => handleReenviar(cuenta)}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="8" cy="15" r="4" />
                                    <path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" />
                                  </svg>
                                </button>
                              ) : null}
                              <button
                                className={`action-btn ${
                                  cuenta.activo ? 'action-btn-destructive' : 'action-btn-neutral'
                                }`}
                                type="button"
                                title={cuenta.activo ? 'Desactivar' : 'Activar'}
                                aria-label={`${cuenta.activo ? 'Desactivar' : 'Activar'} ${nombre}`}
                                disabled={busyId === cuenta.id}
                                onClick={() => handleToggleActivo(cuenta)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M12 3v9" />
                                  <path d="M6.3 6.3a8 8 0 1 0 11.4 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                ) : (
                  <tr className="empty-row">
                    <td colSpan={canEdit ? 4 : 3}>No hay cuentas de módulo registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </TabularWorkspace>

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
