import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import personalService from '../../services/personalService';
import { useToast } from '../../context/ToastContext';
import useSubmitState from '../../hooks/useSubmitState';
import ConfirmDialog from '../../components/ConfirmDialog';
import './Personal.css';

const ROWS_PER_PAGE = 50;

const Personal = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [colaboradores, setColaboradores] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isSubmitting: isSaving,    withSubmit: withSaveSubmit   } = useSubmitState();
  const { isSubmitting: isExporting, withSubmit: withExportSubmit } = useSubmitState();
  const [filters, setFilters] = useState({ search: '', estado: '', cargo: '' });
  const [exportFilters, setExportFilters] = useState({ estado: '', cargo: '' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    nombres_completos: '',
    cedula: '',
    fecha_nacimiento: '',
    cargo: '',
    celular: '',
    banco: '',
    numero_cuenta: '',
    sueldo: '',
    estado: 'activo',
  });

  const buildFilterParams = useCallback((currentFilters) => {
    const params = {};
    if (currentFilters.search) params.search = currentFilters.search;
    if (currentFilters.estado) params.estado = currentFilters.estado;
    if (currentFilters.cargo) params.cargo = currentFilters.cargo;
    return params;
  }, []);

  const loadColaboradores = useCallback(async (params = {}) => {
    setLoading(true);
    const res = await personalService.getColaboradores(params);
    if (res.success) {
      setColaboradores(res.data);
    } else {
      showToast(res.message, 'error');
    }
    setLoading(false);
  }, [showToast]);

  const loadCargos = useCallback(async () => {
    const res = await personalService.getColaboradores();
    if (res.success) {
      const unique = Array.from(new Set((res.data || []).map((c) => c.cargo).filter(Boolean)));
      unique.sort((a, b) => a.localeCompare(b, 'es'));
      setCargos(unique);
    }
  }, []);

  useEffect(() => { loadCargos(); }, [loadCargos]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadColaboradores(buildFilterParams(filters));
    }, 300);
    return () => clearTimeout(handler);
  }, [buildFilterParams, filters, loadColaboradores]);

  const refreshColaboradores = useCallback(() => {
    loadColaboradores(buildFilterParams(filters));
  }, [buildFilterParams, filters, loadColaboradores]);

  const [filtersDraft, setFiltersDraft] = useState({ search: '', estado: '', cargo: '' });
  const [tableSort, setTableSort] = useState({ field: 'nombres_completos', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltersDraft(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    const cleared = { search: '', estado: '', cargo: '' };
    setFiltersDraft(cleared);
    setFilters(cleared);
    setCurrentPage(1);
  };

  const handleTableSort = (field) => {
    setTableSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
    setCurrentPage(1);
  };

  const sortedColaboradores = useMemo(() => {
    const rows = [...colaboradores];
    const direction = tableSort.direction === 'desc' ? -1 : 1;
    const field = tableSort.field || 'nombres_completos';

    rows.sort((a, b) => {
      if (field === 'sueldo') {
        const aNum = Number(a.sueldo || 0);
        const bNum = Number(b.sueldo || 0);
        return (aNum - bNum) * direction;
      }

      const aVal = String(a[field] || '').trim();
      const bVal = String(b[field] || '').trim();
      return aVal.localeCompare(bVal, 'es', { sensitivity: 'base', numeric: true }) * direction;
    });

    return rows;
  }, [colaboradores, tableSort.direction, tableSort.field]);

  const totalPages = Math.max(1, Math.ceil(sortedColaboradores.length / ROWS_PER_PAGE));
  const paginatedColaboradores = sortedColaboradores.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const mobileCards = useMemo(() => paginatedColaboradores.map((colaborador) => (
    <article key={colaborador.id} className="record-card">
      <div className="record-card-header">
        <h3>{colaborador.nombres_completos}</h3>
        <span className={`badge badge-${colaborador.estado === 'activo' ? 'active' : 'inactive'}`}>
          {colaborador.estado}
        </span>
      </div>
      <dl className="record-card-details">
        <div><dt>Cédula</dt><dd>{colaborador.cedula}</dd></div>
        <div><dt>Cargo</dt><dd>{colaborador.cargo}</dd></div>
        <div><dt>Celular</dt><dd>{colaborador.celular || '—'}</dd></div>
        <div><dt>Sueldo</dt><dd>{colaborador.sueldo ? `$${Number.parseFloat(colaborador.sueldo).toFixed(2)}` : '—'}</dd></div>
      </dl>
      <div className="record-card-actions">
        <button className="btn btn-primary btn-sm" onClick={() => openEdit(colaborador)} type="button">Editar</button>
        <button className="btn btn-danger btn-sm" onClick={() => setConfirmTarget(colaborador)} type="button">Eliminar</button>
      </div>
    </article>
  )), [paginatedColaboradores]);

  const resetForm = () => setFormData({
    nombres_completos: '', cedula: '', fecha_nacimiento: '',
    cargo: '', celular: '', banco: '', numero_cuenta: '', sueldo: '', estado: 'activo',
  });

  const openCreate = () => { setEditingColaborador(null); resetForm(); setFormErrors({}); setShowModal(true); };

  const openExportModal = () => {
    setExportFilters({
      estado: filters.estado,
      cargo: filters.cargo
    });
    setShowExportModal(true);
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
      estado: colaborador.estado || 'activo',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSave = withSaveSubmit(async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.nombres_completos.trim()) errors.nombres_completos = 'Ingresa el nombre completo';
    if (!formData.cedula.trim()) errors.cedula = 'Ingresa la cédula';
    if (!formData.fecha_nacimiento) errors.fecha_nacimiento = 'Selecciona la fecha de nacimiento';
    if (!formData.cargo.trim()) errors.cargo = 'Ingresa el cargo';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast(Object.values(errors)[0], 'error');
      return;
    }
    const payload = { ...formData, sueldo: formData.sueldo ? Number.parseFloat(formData.sueldo) : null };
    const result = editingColaborador
      ? await personalService.updateColaborador(editingColaborador.id, payload)
      : await personalService.createColaborador(payload);

    if (result.success) {
      showToast(editingColaborador ? 'Colaborador actualizado' : 'Colaborador creado', 'success');
      setShowModal(false);
      refreshColaboradores();
    } else {
      showToast(result.message, 'error');
    }
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    const result = await personalService.deleteColaborador(confirmTarget.id);
    if (result.success) {
      showToast('Colaborador eliminado', 'success');
      refreshColaboradores();
    } else {
      showToast(result.message, 'error');
    }
    setConfirmTarget(null);
  };

  const handleExport = withExportSubmit(async () => {
    const params = {};
    if (exportFilters.estado) params.estado = exportFilters.estado;
    if (exportFilters.cargo) params.cargo = exportFilters.cargo;
    const result = await personalService.exportExcel(params);
    if (!result.success) showToast(result.message, 'error');
    setShowExportModal(false);
  });

  const saveLabel   = editingColaborador ? 'Guardar cambios' : 'Crear colaborador';
  const savingLabel = editingColaborador ? 'Guardando…'      : 'Creando…';

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
          <h1>Manejo del personal</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={openCreate}>Nuevo colaborador</button>
          <button className="btn btn-ghost btn-sm" onClick={openExportModal}>Generar reporte</button>
          <button className="btn btn-ghost btn-sm btn-icon-only" onClick={refreshColaboradores} title="Actualizar datos">↻</button>
        </div>
      </header>

      {/* Filters */}
      <div className="ff-filter-row personal-filter-row">
        <div className="ff-filter-card personal-filter-card">
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
                placeholder="Nombre, cédula, celular o cuenta..."
              />
            </div>

            <div className="ff-state">
              <span className="ff-state-label">Estado</span>
              <select name="estado" value={filtersDraft.estado} onChange={handleFilterChange}>
                <option value="">Todos</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="ff-state">
              <span className="ff-state-label">Cargo</span>
              <select name="cargo" value={filtersDraft.cargo} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {cargos.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
              </select>
            </div>

          </div>
        </div>
        <div className="ff-filter-actions-card personal-filter-actions-card">
          <div className="ff-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={applyFilters}>Aplicar</button>
            <button className="ff-clear-btn" type="button" onClick={handleClearFilters}>Limpiar</button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-spinner-wrap">
          <span className="spinner" />
          <span>Cargando colaboradores…</span>
        </div>
      ) : (
        <div className="table-responsive app-table-shell personal-table-shell">
          <table className="app-table personal-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('nombres_completos')}>
                    Nombre
                    <span className={`th-sort-indicator${tableSort.field === 'nombres_completos' ? ' active' : ''}`}>
                      {tableSort.field === 'nombres_completos' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('cedula')}>
                    Cédula
                    <span className={`th-sort-indicator${tableSort.field === 'cedula' ? ' active' : ''}`}>
                      {tableSort.field === 'cedula' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('cargo')}>
                    Cargo
                    <span className={`th-sort-indicator${tableSort.field === 'cargo' ? ' active' : ''}`}>
                      {tableSort.field === 'cargo' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th>Estado</th>
                <th>Contacto</th>
                <th>Banco / Cuenta</th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleTableSort('sueldo')}>
                    Sueldo
                    <span className={`th-sort-indicator${tableSort.field === 'sueldo' ? ' active' : ''}`}>
                      {tableSort.field === 'sueldo' && tableSort.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  </button>
                </th>
                <th className="center col-actions app-col-actions app-col-actions--double"></th>
              </tr>
            </thead>
            <tbody>
              {sortedColaboradores.length > 0 ? paginatedColaboradores.map((c) => (
                <tr key={c.id}>
                  <td className="cell-person-name">{c.nombres_completos}</td>
                  <td className="cell-nowrap">{c.cedula}</td>
                  <td>{c.cargo}</td>
                  <td>
                    <span className={`badge badge-${c.estado === 'activo' ? 'active' : 'inactive'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="cell-nowrap">{c.celular || '—'}</td>
                  <td>
                    <div className="bank-cell">
                      <span>{c.banco || '—'}</span>
                      {c.numero_cuenta ? <small>{c.numero_cuenta}</small> : null}
                    </div>
                  </td>
                  <td className="col-money">{c.sueldo ? `$${Number.parseFloat(c.sueldo).toFixed(2)}` : '—'}</td>
                  <td className="center col-actions app-col-actions app-col-actions--double">
                    <div className="action-buttons app-table-actions">
                      <button className="action-btn action-btn-cancel" onClick={() => openEdit(c)} title="Editar">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z"/>
                          <path d="M14.5 5.5l3.5 3.5"/>
                        </svg>
                      </button>
                      <button className="action-btn action-btn-del" onClick={() => setConfirmTarget(c)} title="Eliminar">
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
                <tr className="empty-row"><td colSpan="8">No hay colaboradores registrados</td></tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination personal-pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                type="button"
              >‹ Anterior</button>
              <span className="pagination-info">
                Página <span className="pagination-count">{currentPage}</span> de {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                type="button"
              >Siguiente ›</button>
            </div>
          )}
        </div>
      )}

      {/* Mobile cards */}
      {!loading && sortedColaboradores.length > 0 && (
        <div className="records-mobile">{mobileCards}</div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal personal-modal">
            <div className="modal-header">
              <h3>{editingColaborador ? 'Editar colaborador' : 'Nuevo colaborador'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Cerrar">×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body personal-form-grid">
                <div className="form-group">
                  <label htmlFor="p-nombres">Nombre completo <span className="required">*</span></label>
                  <input id="p-nombres" name="nombres_completos" value={formData.nombres_completos} onChange={handleFormChange} required />
                  {formErrors.nombres_completos ? <span className="field-error">{formErrors.nombres_completos}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="p-cedula">Cédula <span className="required">*</span></label>
                  <input id="p-cedula" name="cedula" value={formData.cedula} onChange={handleFormChange} required disabled={!!editingColaborador} />
                  {formErrors.cedula ? <span className="field-error">{formErrors.cedula}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="p-fnac">Fecha de nacimiento <span className="required">*</span></label>
                  <input id="p-fnac" type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleFormChange} required disabled={!!editingColaborador} />
                  {formErrors.fecha_nacimiento ? <span className="field-error">{formErrors.fecha_nacimiento}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="p-cargo">Cargo <span className="required">*</span></label>
                  <input id="p-cargo" name="cargo" value={formData.cargo} onChange={handleFormChange} required />
                  {formErrors.cargo ? <span className="field-error">{formErrors.cargo}</span> : null}
                </div>
                <div className="form-group">
                  <label htmlFor="p-celular">Celular</label>
                  <input id="p-celular" name="celular" value={formData.celular} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="p-banco">Banco</label>
                  <input id="p-banco" name="banco" value={formData.banco} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="p-cuenta">Número de cuenta</label>
                  <input id="p-cuenta" name="numero_cuenta" value={formData.numero_cuenta} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="p-sueldo">Sueldo</label>
                  <div className="money-input-wrapper">
                    <span className="money-input-prefix">$</span>
                    <input id="p-sueldo" type="number" step="0.01" name="sueldo" value={formData.sueldo} onChange={handleFormChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="p-estado">Estado</label>
                  <select id="p-estado" name="estado" value={formData.estado} onChange={handleFormChange}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="modal-buttons personal-modal-actions">
                <button className="btn btn-primary" type="submit" disabled={isSaving}>
                  {isSaving ? <><span className="spinner spinner--sm" />{savingLabel}</> : saveLabel}
                </button>
                <button className="btn btn-modal-clear" type="button" onClick={() => setShowModal(false)} disabled={isSaving}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal personal-modal personal-report-modal">
            <div className="modal-header">
              <h3>Generar Reporte de Personal</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="modal-body">
              <div className="report-form-grid">
              <div className="form-group">
                <label htmlFor="exp-estado">Estado</label>
                <select id="exp-estado" value={exportFilters.estado} onChange={(e) => setExportFilters(prev => ({ ...prev, estado: e.target.value }))}>
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="exp-cargo">Cargo</label>
                <select id="exp-cargo" value={exportFilters.cargo} onChange={(e) => setExportFilters(prev => ({ ...prev, cargo: e.target.value }))}>
                  <option value="">Todos</option>
                  {cargos.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
                </select>
              </div>
              </div>
            </div>
            <div className="modal-buttons personal-modal-actions">
              <button className="btn btn-primary" onClick={handleExport} disabled={isExporting}>
                {isExporting ? <><span className="spinner spinner--sm" />Generando…</> : 'Exportar reporte'}
              </button>
              <button className="btn btn-modal-clear" onClick={() => setShowExportModal(false)} disabled={isExporting}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Eliminar colaborador"
        message={confirmTarget ? `¿Eliminar a ${confirmTarget.nombres_completos}? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

export default Personal;
