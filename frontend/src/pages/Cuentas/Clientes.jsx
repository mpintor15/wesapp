import React, { useState } from 'react';
import cuentasService from '../../services/cuentasService';

const Clientes = ({
  clientes,
  onClienteCreated,
  onClienteDeleted,
  message,
  setMessage,
  showClienteForm,
  setShowClienteForm
}) => {
  const [newClienteName, setNewClienteName] = useState('');
  const [newClienteId, setNewClienteId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!newClienteName.trim()) {
      setMessage({ type: 'error', text: 'El nombre del cliente es requerido' });
      setLoading(false);
      return;
    }

    if (!newClienteId.trim()) {
      setMessage({ type: 'error', text: 'La identificación del cliente es requerida' });
      setLoading(false);
      return;
    }

    const result = await cuentasService.createCliente(newClienteName, newClienteId);

    if (result.success) {
      setMessage({ type: 'success', text: 'Cliente creado exitosamente' });
      setNewClienteName('');
      setNewClienteId('');
      setShowClienteForm(false);
      onClienteCreated();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    setLoading(false);
  };

  const handleDeleteCliente = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
      const result = await cuentasService.deleteCliente(id);

      if (result.success) {
        setMessage({ type: 'success', text: 'Cliente eliminado exitosamente' });
        onClienteDeleted();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    }
  };

  return (
    <div className="clientes-module">
      <div className="clientes-header">
        <h3>Gestión de Clientes</h3>
      </div>

      {showClienteForm && (
        <div className="modal-overlay" onClick={() => setShowClienteForm(false)}>
          <div className="modal modal-cliente" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear cliente</h3>
              <button className="modal-close" onClick={() => setShowClienteForm(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleCreateCliente}>
              <div className="form-group">
                <label>Nombre del Cliente</label>
                <input
                  type="text"
                  value={newClienteName}
                  onChange={(e) => setNewClienteName(e.target.value)}
                  placeholder="Ingresa el nombre del cliente"
                  disabled={loading}
                  required
                />
              </div>
              <div className="form-group">
                <label>Identificación (CI o RUC)</label>
                <input
                  type="text"
                  value={newClienteId}
                  onChange={(e) => setNewClienteId(e.target.value)}
                  placeholder="Ej: 1790012345001"
                  disabled={loading}
                  required
                />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear cliente'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowClienteForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clientes && clientes.length > 0 && (
        <div className="clientes-list">
          <h4>Clientes Registrados ({clientes.length})</h4>
          <div className="table-responsive">
            <table className="data-table clientes-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Identificación</th>
                  <th className="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(cliente => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre}</td>
                    <td>{cliente.identificacion || '-'}</td>
                    <td className="col-actions">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteCliente(cliente.id)}
                        disabled={loading}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!clientes || clientes.length === 0) && !showClienteForm && (
        <div className="empty-state">
          <p>No hay clientes registrados. Crea uno para empezar.</p>
        </div>
      )}
    </div>
  );
};

export default Clientes;
