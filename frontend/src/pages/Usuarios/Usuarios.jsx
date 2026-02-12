import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usuariosService from '../../services/usuariosService';
import './Usuarios.css';

const TIPOS_USUARIO = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'secretario', label: 'Secretario' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'contador', label: 'Contador' }
];

const Usuarios = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({ search: '', tipo_usuario: '', activo: '' });
  const [filtersDraft, setFiltersDraft] = useState({ search: '', tipo_usuario: '', activo: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
    tipo_usuario: 'secretario'
  });
  const [editData, setEditData] = useState({
    tipo_usuario: 'secretario',
    activo: true
  });

  useEffect(() => {
    loadUsuarios();
  }, []);

  useEffect(() => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.tipo_usuario) params.tipo_usuario = filters.tipo_usuario;
    if (filters.activo) params.activo = filters.activo;
    loadUsuarios(params);
  }, [filters.search, filters.tipo_usuario, filters.activo]);

  const loadUsuarios = async (params = {}) => {
    setLoading(true);
    const res = await usuariosService.getUsuarios(params);
    if (res.success) {
      setUsuarios(res.data);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
    setLoading(false);
  };


  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltersDraft(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
  };

  const clearFilters = () => {
    const cleared = { search: '', tipo_usuario: '', activo: '' };
    setFiltersDraft(cleared);
    setFilters(cleared);
  };

  const resetCreateForm = () => {
    setFormData({ usuario: '', password: '', tipo_usuario: 'secretario' });
  };

  const openCreate = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const openEdit = (usuario) => {
    setSelectedUsuario(usuario);
    setEditData({ tipo_usuario: usuario.tipo_usuario, activo: usuario.activo });
    setShowEditModal(true);
  };


  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.usuario || !formData.tipo_usuario) {
      setMessage({ type: 'error', text: 'Usuario y tipo son requeridos' });
      return;
    }
    if (formData.password && formData.password.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    const result = await usuariosService.createUsuario(formData);
    if (result.success) {
      setMessage({ type: 'success', text: 'Usuario creado' });
      setShowCreateModal(false);
      loadUsuarios();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedUsuario) return;
    const result = await usuariosService.updateUsuario(selectedUsuario.id, editData);
    if (result.success) {
      setMessage({ type: 'success', text: 'Usuario actualizado' });
      setShowEditModal(false);
      loadUsuarios();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleDelete = async (usuario) => {
    if (!window.confirm(`¿Eliminar al usuario ${usuario.usuario}?`)) return;
    const result = await usuariosService.deleteUsuario(usuario.id);
    if (result.success) {
      setMessage({ type: 'success', text: 'Usuario eliminado' });
      loadUsuarios();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="usuarios-container">
      <header className="usuarios-header">
        <div className="usuarios-header-left">
          <button className="btn-back" onClick={() => navigate('/')}>← Volver</button>
          <div>
            <h1>Control de usuarios</h1>
          </div>
        </div>
        <div className="usuarios-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            Crear usuario
          </button>
        </div>
      </header>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })}>×</button>
        </div>
      )}

      <div className="usuarios-filters">
        <div className="filter-field">
          <label>Buscar</label>
          <input
            type="text"
            name="search"
            value={filtersDraft.search}
            onChange={handleFilterChange}
            placeholder="Usuario"
          />
        </div>
        <div className="filter-field">
          <label>Tipo</label>
          <select name="tipo_usuario" value={filtersDraft.tipo_usuario} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {TIPOS_USUARIO.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Estado</label>
          <select name="activo" value={filtersDraft.activo} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-primary" onClick={applyFilters}>
            Aplicar
          </button>
          <button className="btn btn-secondary" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length > 0 ? (
                usuarios.map(u => (
                  <tr key={u.id}>
                    <td>{u.usuario}</td>
                    <td>{u.tipo_usuario}</td>
                    <td>{u.primer_login ? 'Inactivo' : 'Activo'}</td>
                    <td className="col-actions">
                      <div className="action-buttons">
                        <button className="action-btn btn-edit" onClick={() => openEdit(u)} title="Editar">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14.5 5.5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button className="action-btn btn-danger" onClick={() => handleDelete(u)} title="Eliminar">X</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center">No hay usuarios</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal usuarios-modal">
            <div className="usuarios-modal-header">
              <h3>Nuevo Usuario</h3>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cerrar</button>
            </div>
            <form className="usuarios-form" onSubmit={handleCreate}>
              <div className="form-group">
                <label>Usuario</label>
                <input value={formData.usuario} onChange={(e) => setFormData(prev => ({ ...prev, usuario: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Contraseña (opcional)</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={formData.tipo_usuario} onChange={(e) => setFormData(prev => ({ ...prev, tipo_usuario: e.target.value }))}>
                  {TIPOS_USUARIO.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-primary" type="submit">Crear</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowCreateModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUsuario && (
        <div className="modal-overlay">
          <div className="modal usuarios-modal">
            <div className="usuarios-modal-header">
              <h3>Editar Usuario</h3>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cerrar</button>
            </div>
            <form className="usuarios-form" onSubmit={handleEdit}>
              <div className="form-group">
                <label>Tipo</label>
                <select value={editData.tipo_usuario} onChange={(e) => setEditData(prev => ({ ...prev, tipo_usuario: e.target.value }))}>
                  {TIPOS_USUARIO.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={editData.activo ? 'true' : 'false'} onChange={(e) => setEditData(prev => ({ ...prev, activo: e.target.value === 'true' }))}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowEditModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Usuarios;
