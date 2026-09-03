import { formatDate, formatMetodoPago, formatMoney } from '../utils/cuentasFormatters';
import SortHeader from './SortHeader';

const getFacturasLabel = (pago) => {
  const count = pago.facturas_count || pago.facturas?.length || 0;
  return `${count} ${count === 1 ? 'factura' : 'facturas'}`;
};

const PagosTable = ({ rows, loading, filters, sort, selectedPagoId, onSort, onSelectPago }) => (
  <div className="table-responsive app-table-shell app-table-scroll pagos-table-shell">
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
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={5} className="text-center">
              <span className="spinner spinner--sm" /> Cargando pagos…
            </td>
          </tr>
        ) : rows.length > 0 ? (
          rows.map((pago, index) => (
            <tr
              key={pago.id}
              className={`${index % 2 === 0 ? 'row-even' : 'row-odd'} clickable-row${selectedPagoId === pago.id ? ' is-selected' : ''}`}
              onClick={() => onSelectPago(pago)}
              tabIndex={0}
              aria-selected={selectedPagoId === pago.id}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectPago(pago);
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
                <button
                  className="payment-invoices-chip"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectPago(pago);
                  }}
                  aria-label={`Ver ${getFacturasLabel(pago)} del pago #${pago.id}`}
                >
                  {getFacturasLabel(pago)}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="text-center">
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
