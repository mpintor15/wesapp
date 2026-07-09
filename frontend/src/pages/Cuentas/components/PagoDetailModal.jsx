import AppModal from '../../../components/AppModal';
import { formatDate, formatMetodoPago, formatMoney } from '../utils/cuentasFormatters';

const PagoDetailModal = ({ pago, onClose }) => {
  if (!pago) return null;

  return (
    <AppModal
      isOpen={Boolean(pago)}
      onClose={onClose}
      closeOnBackdrop
      title={`Pago #${pago.id}`}
      size="lg"
      className="pago-detail-modal"
    >
      <AppModal.Header />
      <AppModal.Body>
        <div className="pago-detail-context">
          <span>
            Cliente: <strong>{pago.cliente}</strong>
          </span>
          <span>
            Fecha: <strong>{formatDate(pago.fecha)}</strong>
          </span>
          <span>
            Método: <strong>{formatMetodoPago(pago.metodo_pago)}</strong>
          </span>
          <span>
            Total: <strong>{formatMoney(pago.total)}</strong>
          </span>
        </div>
        {(pago.referencia || pago.notas) && (
          <div className="pago-detail-notes">
            {pago.referencia ? (
              <p>
                <strong>Referencia:</strong> {pago.referencia}
              </p>
            ) : null}
            {pago.notas ? (
              <p>
                <strong>Notas:</strong> {pago.notas}
              </p>
            ) : null}
          </div>
        )}
        <div className="table-responsive pago-detail-table-shell">
          <table className="app-table pago-detail-table">
            <thead>
              <tr>
                <th>N° Fact</th>
                <th>Fecha factura</th>
                <th className="col-money">Valor factura</th>
                <th className="col-money">Aplicado</th>
                <th className="col-money">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {pago.facturas?.length > 0 ? (
                pago.facturas.map((factura) => (
                  <tr key={`${pago.id}-${factura.abono_id || factura.num_factura}`}>
                    <td className="cell-factura">#{factura.num_factura}</td>
                    <td className="app-cell-date">{formatDate(factura.fecha_factura)}</td>
                    <td className="col-money">{formatMoney(factura.valor_factura)}</td>
                    <td className="col-money">{formatMoney(factura.valor_abono)}</td>
                    <td className="col-money">{formatMoney(factura.saldo_pendiente)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center">
                    Este pago no tiene facturas asociadas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AppModal.Body>
      <AppModal.Footer>
        <button type="button" className="btn btn-modal-clear" onClick={onClose}>
          Cerrar
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default PagoDetailModal;
