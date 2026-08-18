import { formatDate, formatMoney } from '../utils/cuentasFormatters';

const PagoInvoicesPanel = ({ pago }) => (
  <aside className="pago-invoices-panel" aria-live="polite" aria-label="Facturas relacionadas">
    <div className="pago-invoices-panel__header">
      <h3>Facturas relacionadas</h3>
      {pago ? <span>Pago #{pago.id}</span> : null}
    </div>

    {!pago ? (
      <div className="pago-invoices-panel__empty">
        Selecciona un pago para visualizar las facturas asociadas.
      </div>
    ) : pago.facturas?.length > 0 ? (
      <div className="pago-invoices-panel__list">
        {pago.facturas.map((factura) => (
          <article
            className="pago-invoice-card"
            key={`${pago.id}-${factura.abono_id || factura.num_factura}`}
          >
            <div className="pago-invoice-card__heading">
              <strong>Factura #{factura.num_factura}</strong>
              <span className={`badge ${factura.cancelada ? 'badge-inactive' : 'badge-active'}`}>
                {factura.cancelada ? 'Anulada' : 'Activa'}
              </span>
            </div>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>{formatDate(factura.fecha_factura)}</dd>
              </div>
              {pago.cliente ? (
                <div>
                  <dt>Cliente</dt>
                  <dd>{pago.cliente}</dd>
                </div>
              ) : null}
              <div>
                <dt>Total</dt>
                <dd>{formatMoney(factura.valor_factura)}</dd>
              </div>
              <div className="pago-invoice-card__applied">
                <dt>Aplicado</dt>
                <dd>{formatMoney(factura.valor_abono)}</dd>
              </div>
              <div>
                <dt>Saldo</dt>
                <dd>{formatMoney(factura.saldo_pendiente)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    ) : (
      <div className="pago-invoices-panel__empty">Este pago no tiene facturas asociadas.</div>
    )}
  </aside>
);

export default PagoInvoicesPanel;
