import { useCallback, useEffect, useState } from 'react';
import AppModal from '../../../components/AppModal';
import TabularWorkspace from '../../../components/TabularWorkspace';
import { useToast } from '../../../context/ToastContext';
import useSubmitState from '../../../hooks/useSubmitState';
import usuariosService from '../../../services/usuariosService';
import CuentaAccesosMatrix, { summarizeAccesos } from './CuentaAccesosMatrix';
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
  const [catalogo, setCatalogo] = useState([]);
  const [accesos, setAccesos] = useState({});
  // Cuenta cuyos accesos se están editando (null = modal cerrado).
  const [editando, setEditando] = useState(null);
  const [editAccesos, setEditAccesos] = useState({});
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

  // El catálogo de módulos solo se pide cuando se va a crear o editar una cuenta.
  const needsCatalogo = showCreate || editando !== null;
  useEffect(() => {
    if (!needsCatalogo || catalogo.length > 0) return;
    usuariosService.getCatalogoCuentasModulo().then((res) => {
      if (res.success) setCatalogo(res.data);
      else showToast(res.message, 'error');
    });
  }, [needsCatalogo, catalogo.length, showToast]);

  const handleCreate = withSubmit(async (event) => {
    event.preventDefault();
    if (Object.keys(accesos).length === 0) {
      showToast('Selecciona al menos un acceso para la cuenta', 'error');
      return;
    }
    const res = await usuariosService.createCuentaModulo({
      nombre: form.nombre.trim(),
      usuario: form.usuario.trim(),
      accesos,
    });
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    onCloseCreate();
    setForm(EMPTY_FORM);
    setAccesos({});
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
      setAccesos({});
      setUsuarioEditado(false);
    }
  }, [showCreate]);

  const openEditAccesos = (cuenta) => {
    setEditAccesos(cuenta.accesos_cuenta || {});
    setEditando(cuenta);
  };

  const handleSaveAccesos = async (event) => {
    event.preventDefault();
    if (Object.keys(editAccesos).length === 0) {
      showToast('Selecciona al menos un acceso para la cuenta', 'error');
      return;
    }
    setBusyId(editando.id);
    const res = await usuariosService.updateCuentaModulo(editando.id, { accesos: editAccesos });
    setBusyId(null);
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    showToast('Accesos actualizados. Aplican en su próximo inicio de sesión.', 'success');
    setEditando(null);
    load();
  };

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
                  <th>Accesos</th>
                  <th className="center">Estado</th>
                  {canEdit ? (
                    <th className="center col-actions app-col-actions app-col-actions--triple"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {cuentas.length > 0 ? (
                  cuentas.map((cuenta) => {
                    const estado = getEstado(cuenta);
                    const nombre = [cuenta.nombre, cuenta.apellido].filter(Boolean).join(' ');
                    return (
                      <tr key={cuenta.id}>
                        <td className="cell-person-name">{nombre}</td>
                        <td className="cell-nowrap">@{cuenta.usuario}</td>
                        <td>{summarizeAccesos(cuenta.accesos_cuenta)}</td>
                        <td className="cell-status center">
                          <span className={`badge ${estado.className}`}>{estado.label}</span>
                        </td>
                        {canEdit ? (
                          <td className="center col-actions app-col-actions app-col-actions--triple">
                            <div className="action-buttons app-table-actions">
                              <button
                                className="action-btn action-btn-neutral"
                                type="button"
                                title="Editar accesos"
                                aria-label={`Editar accesos de ${nombre}`}
                                disabled={busyId === cuenta.id}
                                onClick={() => openEditAccesos(cuenta)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
                                  <path d="M9 12l2 2 4-4" />
                                </svg>
                              </button>
                              {cuenta.activo && cuenta.primer_login ? (
                                <button
                                  className="action-btn action-btn-neutral"
                                  type="button"
                                  title="Reenviar invitación"
                                  aria-label={`Reenviar invitación de ${nombre}`}
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
                    <td colSpan={canEdit ? 5 : 4}>No hay cuentas de módulo registradas.</td>
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
              <div className="form-group usuarios-form-grid__full">
                <span className="cuenta-accesos__title">
                  Accesos <span className="required">*</span>
                </span>
                <CuentaAccesosMatrix catalogo={catalogo} value={accesos} onChange={setAccesos} />
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

      {editando && (
        <AppModal
          isOpen
          onClose={() => setEditando(null)}
          title={`Accesos de ${[editando.nombre, editando.apellido].filter(Boolean).join(' ')}`}
          size="md"
          className="usuarios-modal"
        >
          <AppModal.Header />
          <form onSubmit={handleSaveAccesos}>
            <AppModal.Body className="usuarios-form-grid">
              <div className="form-group usuarios-form-grid__full">
                <CuentaAccesosMatrix
                  catalogo={catalogo}
                  value={editAccesos}
                  onChange={setEditAccesos}
                />
              </div>
            </AppModal.Body>
            <AppModal.Footer className="usuarios-modal-actions">
              <button className="btn btn-primary" type="submit" disabled={busyId === editando.id}>
                Guardar accesos
              </button>
              <button
                className="btn btn-modal-clear"
                type="button"
                onClick={() => setEditando(null)}
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
