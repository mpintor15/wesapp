import AppModal from '../../../components/AppModal';
import ConfirmDialog from '../../../components/ConfirmDialog';

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
      <AppModal
        isOpen
        onClose={onCancelDeleteCantidad}
        title="Eliminar cantidad"
        size="sm"
        closeOnBackdrop
        variant="alertdialog"
        className="inventory-delete-modal"
      >
        <AppModal.Header />
        <AppModal.Body>
          <p className="delete-context">
            Artículo:{' '}
            <strong>
              {deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}
            </strong>
          </p>
          <div className="form-group">
            <label htmlFor="inventory-delete-quantity">Cantidad a eliminar</label>
            <input
              id="inventory-delete-quantity"
              type="number"
              min="1"
              max={deleteTarget.cantidad}
              value={deleteCantidad}
              onChange={(e) => onDeleteCantidadChange(parseInt(e.target.value || '1', 10))}
            />
          </div>
          <p className="delete-hint">Disponible: {deleteTarget.cantidad} unidades</p>
        </AppModal.Body>
        <AppModal.Footer className="inventory-modal-actions">
          <button className="btn btn-neutral" onClick={onCancelDeleteCantidad} type="button">
            Cancelar
          </button>
          <button className="btn btn-destructive" onClick={onConfirmDeleteCantidad} type="button">
            Eliminar
          </button>
        </AppModal.Footer>
      </AppModal>
    )}

    <ConfirmDialog
      isOpen={showConfirmDeleteModal && !!deleteTarget}
      title="Confirmar eliminación"
      message={
        deleteTarget ? (
          <>
            <p>
              ¿Estás seguro de eliminar{' '}
              <strong>
                {deleteTarget.nombre_articulo || deleteTarget.numero_serie || deleteTarget.id}
              </strong>
              ?
            </p>
            <p>Esta acción no se puede deshacer.</p>
          </>
        ) : (
          ''
        )
      }
      confirmText="Eliminar"
      cancelText="Cancelar"
      variant="danger"
      onConfirm={onConfirmSimpleDelete}
      onCancel={onCancelConfirmDelete}
    />
  </>
);

export default InventarioDeleteDialogs;
