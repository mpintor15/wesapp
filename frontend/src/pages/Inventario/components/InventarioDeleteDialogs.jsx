const InventarioDeleteDialogs = ({
  deleteCantidad,
  deleteTarget,
  onCancelConfirmDelete,
  onCancelDeleteCantidad,
  onConfirmDeleteCantidad,
  onConfirmSimpleDelete,
  onDeleteCantidadChange,
  showConfirmDeleteModal,
  showDeleteModal,
}) => (
  <>
    {showDeleteModal && deleteTarget && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onCancelDeleteCantidad()}
      >
        <div className="modal modal-delete">
          <div className="modal-header">
            <h3>Eliminar cantidad</h3>
            <button className="modal-close" onClick={onCancelDeleteCantidad} type="button">
              ×
            </button>
          </div>
          <div className="modal-body">
            <p className="delete-context">
              Artículo:{' '}
              <strong>
                {deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}
              </strong>
            </p>
            <div className="form-group">
              <label>Cantidad a eliminar</label>
              <input
                type="number"
                min="1"
                max={deleteTarget.cantidad}
                value={deleteCantidad}
                onChange={(e) => onDeleteCantidadChange(parseInt(e.target.value || '1', 10))}
              />
            </div>
            <p className="delete-hint">Disponible: {deleteTarget.cantidad} unidades</p>
          </div>
          <div className="modal-buttons">
            <button className="btn btn-modal-clear" onClick={onCancelDeleteCantidad} type="button">
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={onConfirmDeleteCantidad} type="button">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}

    {showConfirmDeleteModal && deleteTarget && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onCancelConfirmDelete()}
      >
        <div className="modal modal-delete">
          <div className="modal-header">
            <h3>Confirmar eliminación</h3>
            <button className="modal-close" onClick={onCancelConfirmDelete} type="button">
              ×
            </button>
          </div>
          <div className="modal-body">
            <p className="delete-context">
              ¿Estás seguro de eliminar{' '}
              <strong>
                {deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}
              </strong>
              ?
            </p>
            <p className="delete-warning">Esta acción no se puede deshacer.</p>
          </div>
          <div className="modal-buttons">
            <button className="btn btn-modal-clear" onClick={onCancelConfirmDelete} type="button">
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={onConfirmSimpleDelete} type="button">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default InventarioDeleteDialogs;
