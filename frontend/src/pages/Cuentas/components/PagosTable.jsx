import { formatDate, formatMetodoPago, formatMoney } from '../utils/cuentasFormatters';
import SortHeader from './SortHeader';

const PagosTable = ({
  rows,
  loading,
  filters,
  sort,
  canDeletePago,
  onSort,
  onOpenDetail,
  onDelete,
}) => (
  <div className="table-responsive app-table-shell pagos-table-shell">
    <table className="app-table pagos-table">
      <thead>
        <tr>
          <SortHeader field="fecha" label="Fecha" sort={sort} onSort={onSort} />
          <th>Cliente</th>
          <th>Método de pago</th>
          <SortHeader
            field="total"
            label="Valor"
            sort={sort}
            onSort={onSort}
            className="col-money"
          />
          <th>Facturas</th>
          {canDeletePago ? <th className="col-actions app-col-actions"></th> : null}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={canDeletePago ? 6 : 5} className="text-center">
              <span className="spinner spinner--sm" /> Cargando pagos…
            </td>
          </tr>
        ) : rows.length > 0 ? (
          rows.map((pago, index) => (
            <tr
              key={pago.id}
              className={`${index % 2 === 0 ? 'row-even' : 'row-odd'} clickable-row`}
              onClick={() => onOpenDetail(pago)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenDetail(pago);
                }
              }}
            >
              <td className="app-cell-date">{formatDate(pago.fecha)}</td>
              <td className="cell-cliente" title={pago.cliente}>
                {pago.cliente}
              </td>
              <td>{formatMetodoPago(pago.metodo_pago)}</td>
              <td className="col-money">{formatMoney(pago.total)}</td>
              <td>
                <span className="payment-invoices-chip">
                  {pago.facturas_count || pago.facturas?.length || 0} factura(s)
                </span>
              </td>
              {canDeletePago ? (
                <td className="col-actions app-col-actions">
                  <div className="action-buttons app-table-actions">
                    <button
                      className="action-btn action-btn-del"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(pago);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      title="Eliminar pago"
                      type="button"
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
              ) : null}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={canDeletePago ? 6 : 5} className="text-center">
              {filters.search || filters.fechaInicio || filters.fechaFin || filters.metodoPago
                ? 'No hay pagos para los filtros seleccionados'
                : 'No hay pagos registrados'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default PagosTable;
