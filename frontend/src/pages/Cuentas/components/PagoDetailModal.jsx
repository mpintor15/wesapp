import { formatDate, formatMetodoPago, formatMoney } from '../utils/cuentasFormatters';

const PagoDetailModal = ({ pago, onClose }) => {
  if (!pago) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pago-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Pago #{pago.id}</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="modal-context pago-detail-context">
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
      </div>
    </div>
  );
};

export default PagoDetailModal;
