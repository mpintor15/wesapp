import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usuariosService from '../../services/usuariosService';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import ConfirmDialog from '../../components/ConfirmDialog';
import './Usuarios.css';

const TIPOS_USUARIO = [
  { value: 'gerente',    label: 'Gerente' },
  { value: 'secretario', label: 'Secretario' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'contador',   label: 'Contador' },
];

const getStatusLabel = (u) => {
  if (!u.activo) return 'Inactivo';
  return u.primer_login ? 'Pendiente' : 'Activo';
};

const getStatusKey = (u) => {
  if (!u.activo) return 'inactive';
  return u.primer_login ? 'pending' : 'active';
};

const fullName = (u) => [u.nombre, u.apellido].filter(Boolean).join(' ') || '—';

const validateCreateForm = (data) => {
  const errors = {};
  if (!data.nombre.trim())    errors.nombre       = 'Ingresa el nombre';
  if (!data.apellido.trim())  errors.apellido     = 'Ingresa el apellido';
  if (!data.usuario.trim())   errors.usuario      = 'Ingresa el usuario';
  if (!data.tipo_usuario)     errors.tipo_usuario = 'Selecciona el tipo de usuario';
  return errors;
};

const sortByField = (rows, field, direction) => {
  const dir = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) =>
    String(a[field] || '').trim().localeCompare(String(b[field] || '').trim(), 'es', { sensitivity: 'base' }) * dir
  );
};

const buildInvitationMessage = (nombre, apellido, usuario, tempPassword) => {
  const url = globalThis.location.origin;
  return `Hola ${nombre} ${apellido}, te damos la bienvenida al sistema WES Security.

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

const Usuarios = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', tipo_usuario: '', activo: '' });
  const [filtersDraft, setFiltersDraft] = useState({ search: '', tipo_usuario: '', activo: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [invitationData, setInvitationData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', apellido: '', usuario: '', tipo_usuario: 'secretario' });
  const [createErrors, setCreateErrors] = useState({});
  const [editData, setEditData] = useState({ nombre: '', apellido: '', tipo_usuario: 'secretario', activo: true });
  const [tableSort, setTableSort] = useState({ field: 'apellido', direction: 'asc' });
  const { isSubmitting: isCreating, withSubmit: withCreateSubmit } = useSubmitState();
  const { isSubmitting: isSaving, withSubmit: withSaveSubmit } = useSubmitState();

  const buildFilterParams = useCallback((currentFilters) => {
    const params = {};
    if (currentFilters.search) params.search = currentFilters.search;
    if (currentFilters.tipo_usuario) params.tipo_usuario = currentFilters.tipo_usuario;
    if (currentFilters.activo) params.activo = currentFilters.activo;
    return params;
  }, []);

  const loadUsuarios = useCallback(async (params = {}) => {
    setLoading(true);
    const res = await usuariosService.getUsuarios(params);
    if (res.success) {
      setUsuarios(res.data);
    } else {
      showToast(res.message, 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadUsuarios(buildFilterParams(filters));
  }, [buildFilterParams, filters, loadUsuarios]);

  const refreshUsuarios = useCallback(() => {
    loadUsuarios(buildFilterParams(filters));
  }, [buildFilterParams, filters, loadUsuarios]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltersDraft(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => setFilters(filtersDraft);

  const clearFilters = () => {
    const cleared = { search: '', tipo_usuario: '', activo: '' };
    setFiltersDraft(cleared);
    setFilters(cleared);
  };

  const handleTableSort = (field) => {
    setTableSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedUsuarios = useMemo(
    () => sortByField(usuarios, tableSort.field, tableSort.direction),
    [usuarios, tableSort]
  );

  const mobileCards = useMemo(() => sortedUsuarios.map((u) => (
    <article key={u.id} className="record-card">
      <div className="record-card-header">
        <div>
          <h3>{fullName(u)}</h3>
          <small className="card-username">@{u.usuario}</small>
        </div>
        <span className={`badge badge-${getStatusKey(u)}`}>
          {getStatusLabel(u)}
        </span>
      </div>
      <dl className="record-card-details">
        <div>
          <dt>Tipo</dt>
          <dd>{TIPOS_USUARIO.find((t) => t.value === u.tipo_usuario)?.label ?? u.tipo_usuario}</dd>
        </div>
        <div>
          <dt>Primer acceso</dt>
          <dd>{u.primer_login ? 'Pendiente' : 'Completado'}</dd>
        </div>
      </dl>
      <div className="record-card-actions">
        <button className="btn btn-primary btn-sm" onClick={() => openEdit(u)} type="button">Editar</button>
        <button className="btn btn-danger btn-sm" onClick={() => setConfirmTarget(u)} type="button">Eliminar</button>
      </div>
    </article>
  )), [sortedUsuarios]);

  const openCreate = () => {
    setFormData({ nombre: '', apellido: '', usuario: '', tipo_usuario: 'secretario' });
    setCreateErrors({});
    setShowCreateModal(true);
  };

  const openEdit = (usuario) => {
    setSelectedUsuario(usuario);
    setEditData({ nombre: usuario.nombre || '', apellido: usuario.apellido || '', tipo_usuario: usuario.tipo_usuario, activo: usuario.activo });
    setShowEditModal(true);
  };

  const handleCreate = withCreateSubmit(async (e) => {
    e.preventDefault();
    const errors = validateCreateForm(formData);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }

    const result = await usuariosService.createUsuario(formData);
    if (result.success) {
      setShowCreateModal(false);
      setInvitationData({
        nombre:        result.data.nombre,
        apellido:      result.data.apellido,
        usuario:       result.data.usuario,
        temp_password: result.data.temp_password,
      });
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleEdit = withSaveSubmit(async (e) => {
    e.preventDefault();
    if (!selectedUsuario) return;
    const result = await usuariosService.updateUsuario(selectedUsuario.id, editData);
    if (result.success) {
      showToast('Usuario actualizado', 'success');
      setShowEditModal(false);
      refreshUsuarios();
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    const result = await usuariosService.deleteUsuario(confirmTarget.id);
    if (result.success) {
      showToast('Usuario eliminado', 'success');
      refreshUsuarios();
    } else {
      showToast(result.message, 'error');
    }
    setConfirmTarget(null);
  };

  const handleCopyInvitation = async () => {
    if (!invitationData) return;
    const msg = buildInvitationMessage(
      invitationData.nombre,
      invitationData.apellido,
      invitationData.usuario,
      invitationData.temp_password
    );
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('No se pudo copiar. Copia el mensaje manualmente.', 'error');
    }
  };

  const closeInvitation = () => {
    setInvitationData(null);
    setCopied(false);
    refreshUsuarios();
  };

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Volver
          </button>
          <h1>Control de usuarios</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={openCreate}>Nuevo usuario</button>
          <button className="btn btn-ghost btn-sm btn-icon-only" onClick={refreshUsuarios} title="Actualizar datos">↻</button>
        </div>
      </header>

      {/* Filters */}
      <div className="ff-filter-row usuarios-filter-row">
        <div className="ff-filter-card usuarios-filter-card">
          <div className="ff-controls">
            <div className="ff-search">
              <svg className="ff-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                name="search"
                value={filtersDraft.search}
                onChange={handleFilterChange}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Nombre, apellido o usuario..."
              />
            </div>
            <div className="ff-state">
              <span className="ff-state-label">Tipo</span>
              <select name="tipo_usuario" value={filtersDraft.tipo_usuario} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="ff-state">
              <span className="ff-state-label">Estado</span>
              <select name="activo" value={filtersDraft.activo} onChange={handleFilterChange}>
                <option value="">Todos</option>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
        </div>
        <div className="ff-filter-actions-card usuarios-filter-actions-card">
          <div className="ff-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={applyFilters}>Aplicar</button>
            <button className="ff-clear-btn" type="button" onClick={clearFilters}>Limpiar</button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-spinner-wrap">
          <span className="spinner" />
          <span>Cargando usuarios…</span>
        </div>
      ) : (
        <div className="table-responsive app-table-shell usuarios-table-shell">
          <table className="app-table usuarios-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('apellido')}>
                    Nombre completo
                    <span className={`th-sort-indicator${tableSort.field === 'apellido' ? ' active' : ''}`}>
                      {tableSort.field === 'apellido' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('usuario')}>
                    Usuario
                    <span className={`th-sort-indicator${tableSort.field === 'usuario' ? ' active' : ''}`}>
                      {tableSort.field === 'usuario' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('tipo_usuario')}>
                    Tipo
                    <span className={`th-sort-indicator${tableSort.field === 'tipo_usuario' ? ' active' : ''}`}>
                      {tableSort.field === 'tipo_usuario' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th>Estado</th>
                <th className="center app-col-actions app-col-actions--double">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsuarios.length > 0 ? sortedUsuarios.map((u) => (
                <tr key={u.id}>
                  <td className="cell-fullname">{fullName(u)}</td>
                  <td className="cell-username">@{u.usuario}</td>
                  <td>{TIPOS_USUARIO.find((t) => t.value === u.tipo_usuario)?.label ?? u.tipo_usuario}</td>
                  <td>
                    <span className={`badge badge-${getStatusKey(u)}`}>{getStatusLabel(u)}</span>
                  </td>
                  <td className="center app-col-actions app-col-actions--double">
                    <div className="action-buttons app-table-actions">
                      <button className="action-btn action-btn-cancel" onClick={() => openEdit(u)} title="Editar">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z"/>
                          <path d="M14.5 5.5l3.5 3.5"/>
                        </svg>
                      </button>
                      <button className="action-btn action-btn-del" onClick={() => setConfirmTarget(u)} title="Eliminar">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr className="empty-row"><td colSpan="5">No hay usuarios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && sortedUsuarios.length > 0 && (
        <div className="records-mobile">{mobileCards}</div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal usuarios-modal">
            <div className="modal-header">
              <h3>Nuevo usuario</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)} aria-label="Cerrar">×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body usuarios-form-grid">
                <div className="form-group">
                  <label htmlFor="u-nombre">Nombre{' '}<span className="required">*</span></label>
                  <input
                    id="u-nombre"
                    value={formData.nombre}
                    onChange={(e) => { setFormData(p => ({ ...p, nombre: e.target.value })); setCreateErrors(p => ({ ...p, nombre: '' })); }}
                    autoComplete="off"
                    required
                  />
                  {createErrors.nombre ? <span className="field-error">{createErrors.nombre}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="u-apellido">Apellido{' '}<span className="required">*</span></label>
                  <input
                    id="u-apellido"
                    value={formData.apellido}
                    onChange={(e) => { setFormData(p => ({ ...p, apellido: e.target.value })); setCreateErrors(p => ({ ...p, apellido: '' })); }}
                    autoComplete="off"
                    required
                  />
                  {createErrors.apellido ? <span className="field-error">{createErrors.apellido}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="u-usuario">Usuario{' '}<span className="required">*</span></label>
                  <input
                    id="u-usuario"
                    value={formData.usuario}
                    onChange={(e) => { setFormData(p => ({ ...p, usuario: e.target.value })); setCreateErrors(p => ({ ...p, usuario: '' })); }}
                    autoComplete="off"
                    required
                  />
                  {createErrors.usuario ? <span className="field-error">{createErrors.usuario}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="u-tipo">Tipo de usuario</label>
                  <select
                    id="u-tipo"
                    value={formData.tipo_usuario}
                    onChange={(e) => setFormData(p => ({ ...p, tipo_usuario: e.target.value }))}
                  >
                    {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-buttons usuarios-modal-actions">
                <button className="btn btn-primary" type="submit" disabled={isCreating}>
                  {isCreating ? <><span className="spinner spinner--sm" />Creando…</> : 'Crear usuario'}
                </button>
                <button className="btn btn-modal-clear" type="button" onClick={() => setShowCreateModal(false)} disabled={isCreating}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitation modal */}
      {invitationData && (
        <div className="modal-overlay">
          <div className="modal usuarios-modal usuarios-invitation-modal">
            <div className="modal-header">
              <h3>Usuario creado</h3>
              <button className="modal-close" onClick={closeInvitation} aria-label="Cerrar">×</button>
            </div>
            <div className="modal-body">
              <p className="invitation-intro">
                Copia este mensaje y envíaselo a <strong>{invitationData.nombre} {invitationData.apellido}</strong> por el canal que prefieras.
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
                onClick={handleCopyInvitation}
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copiar invitación
                  </>
                )}
              </button>
              <button className="btn btn-modal-clear" type="button" onClick={closeInvitation}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && selectedUsuario && (
        <div className="modal-overlay">
          <div className="modal usuarios-modal usuarios-modal--sm">
            <div className="modal-header">
              <h3>Editar — <em>{fullName(selectedUsuario)}</em></h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)} aria-label="Cerrar">×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body usuarios-form-grid">
                <div className="form-group">
                  <label htmlFor="e-nombre">Nombre</label>
                  <input
                    id="e-nombre"
                    value={editData.nombre}
                    onChange={(e) => setEditData(p => ({ ...p, nombre: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="e-apellido">Apellido</label>
                  <input
                    id="e-apellido"
                    value={editData.apellido}
                    onChange={(e) => setEditData(p => ({ ...p, apellido: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="e-tipo">Tipo de usuario</label>
                  <select id="e-tipo" value={editData.tipo_usuario} onChange={(e) => setEditData(p => ({ ...p, tipo_usuario: e.target.value }))}>
                    {TIPOS_USUARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="e-estado">Estado</label>
                  <select id="e-estado" value={editData.activo ? 'true' : 'false'} onChange={(e) => setEditData(p => ({ ...p, activo: e.target.value === 'true' }))}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="modal-buttons usuarios-modal-actions">
                <button className="btn btn-primary" type="submit" disabled={isSaving}>
                  {isSaving ? <><span className="spinner spinner--sm" />Guardando…</> : 'Guardar cambios'}
                </button>
                <button className="btn btn-modal-clear" type="button" onClick={() => setShowEditModal(false)} disabled={isSaving}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Eliminar usuario"
        message={confirmTarget ? `¿Eliminar al usuario "${fullName(confirmTarget)}"? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

export default Usuarios;
