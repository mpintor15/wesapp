import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import personalService from '../../services/personalService';
import './Personal.css';

const Personal = () => {
  const navigate = useNavigate();
  const [colaboradores, setColaboradores] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({ search: '', estado: '', cargo: '' });
  const [exportFilters, setExportFilters] = useState({ estado: '', cargo: '' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState(null);
  const [formData, setFormData] = useState({
    nombres_completos: '',
    cedula: '',
    fecha_nacimiento: '',
    cargo: '',
    celular: '',
    banco: '',
    numero_cuenta: '',
    sueldo: '',
    estado: 'activo'
  });

  useEffect(() => {
    loadColaboradores();
    loadCargos();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.estado) params.estado = filters.estado;
      if (filters.cargo) params.cargo = filters.cargo;
      loadColaboradores(params);
    }, 300);

    return () => clearTimeout(handler);
  }, [filters.search, filters.estado, filters.cargo]);

  const loadColaboradores = async (params = {}) => {
    setLoading(true);
    const res = await personalService.getColaboradores(params);
    if (res.success) {
      setColaboradores(res.data);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
    setLoading(false);
  };

  const loadCargos = async () => {
    const res = await personalService.getColaboradores();
    if (res.success) {
      const unique = Array.from(new Set((res.data || []).map((c) => c.cargo).filter(Boolean)));
      unique.sort((a, b) => a.localeCompare(b, 'es'));
      setCargos(unique);
    }
  };

  const [filtersDraft, setFiltersDraft] = useState({ search: '', estado: '', cargo: '' });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltersDraft(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
  };

  const handleClearFilters = () => {
    const cleared = { search: '', estado: '', cargo: '' };
    setFiltersDraft(cleared);
    setFilters(cleared);
  };

  const resetForm = () => {
    setFormData({
      nombres_completos: '',
      cedula: '',
      fecha_nacimiento: '',
      cargo: '',
      celular: '',
      banco: '',
      numero_cuenta: '',
      sueldo: '',
      estado: 'activo'
    });
  };

  const openCreate = () => {
    setEditingColaborador(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (colaborador) => {
    setEditingColaborador(colaborador);
    setFormData({
      nombres_completos: colaborador.nombres_completos || '',
      cedula: colaborador.cedula || '',
      fecha_nacimiento: colaborador.fecha_nacimiento ? colaborador.fecha_nacimiento.split('T')[0] : '',
      cargo: colaborador.cargo || '',
      celular: colaborador.celular || '',
      banco: colaborador.banco || '',
      numero_cuenta: colaborador.numero_cuenta || '',
      sueldo: colaborador.sueldo ?? '',
      estado: colaborador.estado || 'activo'
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombres_completos || !formData.cedula || !formData.fecha_nacimiento || !formData.cargo) {
      setMessage({ type: 'error', text: 'Completa los campos obligatorios' });
      return;
    }

    const payload = {
      ...formData,
      sueldo: formData.sueldo ? parseFloat(formData.sueldo) : null
    };

    const result = editingColaborador
      ? await personalService.updateColaborador(editingColaborador.id, payload)
      : await personalService.createColaborador(payload);

    if (result.success) {
      setMessage({ type: 'success', text: editingColaborador ? 'Colaborador actualizado' : 'Colaborador creado' });
      setShowModal(false);
      loadColaboradores();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleDelete = async (colaborador) => {
    if (!window.confirm(`¿Eliminar a ${colaborador.nombres_completos}?`)) return;
    const result = await personalService.deleteColaborador(colaborador.id);
    if (result.success) {
      setMessage({ type: 'success', text: 'Colaborador eliminado' });
      loadColaboradores();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleExport = async () => {
    const params = {};
    if (exportFilters.estado) params.estado = exportFilters.estado;
    if (exportFilters.cargo) params.cargo = exportFilters.cargo;

    const result = await personalService.exportExcel(params);
    if (!result.success) {
      setMessage({ type: 'error', text: result.message });
    }
    setShowExportModal(false);
  };

  return (
    <div className="personal-container">
      <header className="personal-header">
        <div className="personal-header-left">
          <button className="btn-back" onClick={() => navigate('/')}>← Volver</button>
          <div>
            <h1>Manejo del personal</h1>
          </div>
        </div>
        <div className="personal-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            Crear colaborador
          </button>
          <button className="btn btn-success" onClick={() => setShowExportModal(true)}>
            Generar reporte
          </button>
        </div>
      </header>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })}>×</button>
        </div>
      )}

      <div className="personal-filters">
        <div className="filter-field">
          <label>Buscar</label>
          <input
            type="text"
            name="search"
            value={filtersDraft.search}
            onChange={handleFilterChange}
            placeholder="Nombre o cédula"
          />
        </div>
        <div className="filter-field">
          <label>Estado</label>
          <select name="estado" value={filtersDraft.estado} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Cargo</label>
          <select name="cargo" value={filtersDraft.cargo} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>{cargo}</option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-primary" onClick={applyFilters}>Aplicar</button>
          <button className="btn btn-secondary" onClick={handleClearFilters}>Limpiar</button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cédula</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Celular</th>
                <th>Banco</th>
                <th>Cuenta</th>
                <th>Sueldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length > 0 ? (
                colaboradores.map(colaborador => (
                  <tr key={colaborador.id}>
                    <td>{colaborador.nombres_completos}</td>
                    <td>{colaborador.cedula}</td>
                    <td>{colaborador.cargo}</td>
                    <td>{colaborador.estado}</td>
                    <td>{colaborador.celular || '-'}</td>
                    <td>{colaborador.banco || '-'}</td>
                    <td>{colaborador.numero_cuenta || '-'}</td>
                    <td>{colaborador.sueldo ? `$${parseFloat(colaborador.sueldo).toFixed(2)}` : '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn btn-edit" onClick={() => openEdit(colaborador)} title="Editar">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14.5 5.5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button className="action-btn btn-danger" onClick={() => handleDelete(colaborador)} title="Eliminar">
                          X
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center">No hay colaboradores</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal personal-modal">
            <div className="personal-modal-header">
              <h3>{editingColaborador ? 'Editar Colaborador' : 'Nuevo Colaborador'}</h3>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cerrar</button>
            </div>
            <form className="personal-form" onSubmit={handleSave}>
              <div className="form-group">
                <label>Nombre completo</label>
                <input name="nombres_completos" value={formData.nombres_completos} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Cédula</label>
                <input
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleFormChange}
                  required
                  disabled={!!editingColaborador}
                />
              </div>
              <div className="form-group">
                <label>Fecha nacimiento</label>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleFormChange}
                  required
                  disabled={!!editingColaborador}
                />
              </div>
              <div className="form-group">
                <label>Cargo</label>
                <input name="cargo" value={formData.cargo} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Celular</label>
                <input name="celular" value={formData.celular} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Banco</label>
                <input name="banco" value={formData.banco} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Número de cuenta</label>
                <input name="numero_cuenta" value={formData.numero_cuenta} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Sueldo</label>
                <input type="number" step="0.01" name="sueldo" value={formData.sueldo} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select name="estado" value={formData.estado} onChange={handleFormChange}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-primary" type="submit">
                  {editingColaborador ? 'Guardar cambios' : 'Crear'}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal personal-modal export-modal">
            <div className="personal-modal-header">
              <h3>Exportar colaboradores</h3>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Cerrar</button>
            </div>
            <div className="personal-form">
              <div className="form-group">
                <label>Estado</label>
                <select
                  value={exportFilters.estado}
                  onChange={(e) => setExportFilters(prev => ({ ...prev, estado: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cargo</label>
                <select
                  value={exportFilters.cargo}
                  onChange={(e) => setExportFilters(prev => ({ ...prev, cargo: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {cargos.map((cargo) => (
                    <option key={cargo} value={cargo}>{cargo}</option>
                  ))}
                </select>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-success" onClick={handleExport}>
                  Descargar Excel
                </button>
                <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personal;
