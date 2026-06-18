import ConfirmDialog from '../../../components/ConfirmDialog';

const CuentasDeleteDialogs = ({
  pagoToDelete,
  facturaToDelete,
  onConfirmPago,
  onCancelPago,
  onConfirmFactura,
  onCancelFactura,
}) => (
  <>
    <ConfirmDialog
      isOpen={!!pagoToDelete}
      title="Eliminar pago"
      message={
        pagoToDelete ? (
          <div className="delete-invoice-confirm">
            <p>
              Vas a eliminar permanentemente el pago <strong>#{pagoToDelete.id}</strong> de{' '}
              <strong>{pagoToDelete.cliente}</strong>.
            </p>
            <p>
              También se eliminarán los abonos asociados y se recalcularán los saldos de sus
              facturas.
            </p>
          </div>
        ) : (
          ''
        )
      }
      confirmText="Eliminar"
      cancelText="Cancelar"
      variant="danger"
      onConfirm={onConfirmPago}
      onCancel={onCancelPago}
    />

    <ConfirmDialog
      isOpen={!!facturaToDelete}
      title="Eliminar factura"
      message={
        facturaToDelete ? (
          <div className="delete-invoice-confirm">
            <p>
              Vas a eliminar permanentemente la factura{' '}
              <strong>#{facturaToDelete.num_factura}</strong>.
            </p>
            <p>También se eliminarán sus abonos asociados. Esta acción no se puede deshacer.</p>
          </div>
        ) : (
          ''
        )
      }
      confirmText="Eliminar"
      cancelText="Cancelar"
      variant="danger"
      onConfirm={onConfirmFactura}
      onCancel={onCancelFactura}
    />
  </>
);

export default CuentasDeleteDialogs;
