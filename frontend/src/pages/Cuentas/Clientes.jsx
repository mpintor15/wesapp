import React, { useState, useMemo } from 'react';
import cuentasService from '../../services/cuentasService';
import { useToast } from '../../context/ToastContext';
import AppModal from '../../components/AppModal';
import ConfirmDialog from '../../components/ConfirmDialog';

const ROWS_PER_PAGE = 50;

const Clientes = ({
  clientes,
  onClienteCreated,
  onClienteDeleted,
  showClienteForm,
  setShowClienteForm,
}) => {
  const { showToast } = useToast();
  const [newClienteName, setNewClienteName] = useState('');
  const [newClienteId, setNewClienteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [clienteErrors, setClienteErrors] = useState({});
  const [search, setSearch] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [clientesSort, setClientesSort] = useState({ field: 'nombre', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.trim().toLowerCase();
    return clientes.filter(
      (c) => c.nombre?.toLowerCase().includes(q) || c.identificacion?.toLowerCase().includes(q)
    );
  }, [clientes, search]);

  const sortedFiltered = useMemo(() => {
    if (!clientesSort.field) return filtered;
    const direction = clientesSort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (clientesSort.field === 'nombre') {
        return (
          String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {
            sensitivity: 'base',
            numeric: true,
          }) * direction
        );
      }
      if (clientesSort.field === 'identificacion') {
        return (
          String(a.identificacion || '').localeCompare(String(b.identificacion || ''), 'es', {
            sensitivity: 'base',
            numeric: true,
          }) * direction
        );
      }
      return 0;
    });
  }, [filtered, clientesSort]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / ROWS_PER_PAGE));
  const paginatedClientes = sortedFiltered.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleClientesSort = (field) => {
    setClientesSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
    setCurrentPage(1);
  };

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    setLoading(true);
    const errors = {};

    if (!newClienteName.trim()) errors.nombre = 'Ingresa el nombre del cliente';
    if (!newClienteId.trim()) errors.identificacion = 'Ingresa la identificación del cliente';

    if (Object.keys(errors).length > 0) {
      setClienteErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      setLoading(false);
      return;
    }

    const result = await cuentasService.createCliente(newClienteName, newClienteId);
    if (result.success) {
      showToast('Cliente creado exitosamente', 'success');
      setNewClienteName('');
      setNewClienteId('');
      setClienteErrors({});
      setShowClienteForm(false);
      onClienteCreated();
    } else {
      showToast(result.message, 'error');
    }
    setLoading(false);
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    const result = await cuentasService.deleteCliente(confirmTarget.id);
    if (result.success) {
      showToast('Cliente eliminado exitosamente', 'success');
      onClienteDeleted();
    } else {
      showToast(result.message, 'error');
    }
    setConfirmTarget(null);
  };

  return (
    <div className="clientes-module">
      {/* Search filter */}
      <div className="ff-filter-row clientes-filters-row">
        <div className="ff-filter-card clientes-filter-card">
          <div className="ff-controls">
            <div className="ff-search">
              <svg
                className="ff-search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Buscar por nombre o identificación..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showClienteForm && (
        <AppModal
          isOpen={showClienteForm}
          onClose={() => setShowClienteForm(false)}
          closeOnBackdrop
          title="Crear Cliente"
          size="sm"
          className="modal-cliente"
        >
          <form onSubmit={handleCreateCliente}>
            <AppModal.Header />
            <AppModal.Body>
              <div className="form-group">
                <label>Nombre del Cliente</label>
                <input
                  type="text"
                  value={newClienteName}
                  onChange={(e) => {
                    setNewClienteName(e.target.value);
                    setClienteErrors((prev) => ({ ...prev, nombre: '' }));
                  }}
                  placeholder="Ingresa el nombre del cliente"
                  disabled={loading}
                  autoFocus
                />
                {clienteErrors.nombre ? (
                  <span className="field-error">{clienteErrors.nombre}</span>
                ) : null}
              </div>
              <div className="form-group">
                <label>Identificación (CI o RUC)</label>
                <input
                  type="text"
                  value={newClienteId}
                  onChange={(e) => {
                    setNewClienteId(e.target.value);
                    setClienteErrors((prev) => ({ ...prev, identificacion: '' }));
                  }}
                  placeholder="Ej: 1790012345001"
                  disabled={loading}
                />
                {clienteErrors.identificacion ? (
                  <span className="field-error">{clienteErrors.identificacion}</span>
                ) : null}
              </div>
            </AppModal.Body>
            <AppModal.Footer className="modal-buttons">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creando...' : 'Crear cliente'}
              </button>
              <button
                type="button"
                className="btn btn-modal-clear"
                onClick={() => setShowClienteForm(false)}
              >
                Cancelar
              </button>
            </AppModal.Footer>
          </form>
        </AppModal>
      )}

      {/* Table */}
      <div className="table-result-count">
        Mostrando {paginatedClientes.length} de {sortedFiltered.length} cliente(s)
      </div>

      <div className="table-responsive app-table-shell">
        <table className="app-table clientes-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={() => handleClientesSort('nombre')}
                >
                  Cliente
                  <span
                    className={`th-sort-indicator${clientesSort.field === 'nombre' ? ' active' : ''}`}
                  >
                    {clientesSort.field === 'nombre' && clientesSort.direction === 'desc'
                      ? '↓'
                      : '↑'}
                  </span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={() => handleClientesSort('identificacion')}
                >
                  Identificación
                  <span
                    className={`th-sort-indicator${clientesSort.field === 'identificacion' ? ' active' : ''}`}
                  >
                    {clientesSort.field === 'identificacion' && clientesSort.direction === 'desc'
                      ? '↓'
                      : '↑'}
                  </span>
                </button>
              </th>
              <th className="app-col-actions app-col-actions--single"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedClientes.length > 0 ? (
              paginatedClientes.map((cliente, idx) => (
                <tr key={cliente.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="clientes-cell-name" title={cliente.nombre}>
                    {cliente.nombre}
                  </td>
                  <td className="clientes-cell-id">{cliente.identificacion || '-'}</td>
                  <td className="app-col-actions app-col-actions--single">
                    <div className="action-buttons app-table-actions">
                      <button
                        className="action-btn action-btn-del"
                        onClick={() => setConfirmTarget(cliente)}
                        title="Eliminar cliente"
                        type="button"
                        disabled={loading}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M6 7h12M9 7v10m6-10v10M9 7h6M10 4h4l1 2H9l1-2M7 7l1 12h8l1-12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="empty-row">
                <td colSpan="3">
                  {search.trim()
                    ? 'No se encontraron clientes con ese criterio.'
                    : 'No hay clientes registrados. Crea uno para empezar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹ Anterior
          </button>
          <span className="pagination-info">
            Página <span className="pagination-count">{currentPage}</span> de {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente ›
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Eliminar cliente"
        message={
          confirmTarget ? (
            <div className="delete-invoice-confirm">
              <p>
                Vas a eliminar permanentemente a <strong>{confirmTarget.nombre}</strong>.
              </p>
              <p>Esta acción solo se completará si el cliente no tiene facturas asociadas.</p>
            </div>
          ) : (
            ''
          )
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

export default Clientes;
