import { formatDate, formatMoney } from '../utils/cuentasFormatters';
import SortHeader from './SortHeader';

const FacturasTable = ({
  rows,
  filteredCount,
  filters,
  sort,
  currentPage,
  totalPages,
  totals,
  isGerente,
  onSort,
  onShowAnulacion,
  onEdit,
  onCancel,
  onDelete,
}) => (
  <div className="table-responsive app-table-shell">
    <table className="app-table cuentas-table">
      <thead>
        <tr>
          <SortHeader field="num_factura" label="N° Fact" sort={sort} onSort={onSort} />
          <SortHeader field="fecha_factura" label="Fecha" sort={sort} onSort={onSort} />
          <SortHeader field="cliente" label="Cliente" sort={sort} onSort={onSort} />
          <th className="col-money" title="Subtotal">
            Subt.
          </th>
          <th className="col-money">IVA</th>
          <th className="col-money">Total</th>
          <th className="col-money" title="Retención fuente">
            Ret. Fte.
          </th>
          <th className="col-money">Ret. IVA</th>
          <th className="col-money" title="Por cobrar">
            X Cob.
          </th>
          <th className="col-money" title="Abonos">
            Abon.
          </th>
          <th className="col-money">Saldo</th>
          <th className="col-actions app-col-actions app-col-actions--triple"></th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? (
          rows.map((row, index) => (
            <tr
              key={row.num_factura}
              className={`${index % 2 === 0 ? 'row-even' : 'row-odd'} ${row.cancelada ? 'row-canceled' : ''}`}
            >
              <td className="cell-factura">
                <span className="cell-factura-num">{row.num_factura}</span>
              </td>
              <td className="app-cell-date">{formatDate(row.fecha_factura)}</td>
              <td className="cell-cliente" title={row.cliente}>
                {row.cliente}
              </td>
              <td className="col-money">{formatMoney(row.subtotal)}</td>
              <td className="col-money">{formatMoney(row.iva)}</td>
              <td className="col-money">
                {formatMoney(parseFloat(row.subtotal || 0) + parseFloat(row.iva || 0))}
              </td>
              <td className="col-money">{formatMoney(row.retencion_fuente)}</td>
              <td className="col-money">{formatMoney(row.retencion_iva)}</td>
              <td className="col-money">{formatMoney(row.por_cobrar)}</td>
              <td className="col-money">{formatMoney(row.total_abonos)}</td>
              <td
                className={`col-money ${parseFloat(row.saldo_pendiente) > 0 ? 'text-danger' : 'text-success'}`}
              >
                {formatMoney(row.saldo_pendiente)}
              </td>
              <td className="col-actions app-col-actions app-col-actions--triple">
                <div className="action-buttons app-table-actions">
                  {row.cancelada ? (
                    <button
                      className="action-btn action-btn-info"
                      onClick={() => onShowAnulacion(row)}
                      title="Ver detalle de anulación"
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        />
                        <line
                          x1="12"
                          y1="8"
                          x2="12"
                          y2="8.5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <line
                          x1="12"
                          y1="12"
                          x2="12"
                          y2="16"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  ) : isGerente ? (
                    <>
                      <button
                        className="action-btn action-btn-edit"
                        onClick={() => onEdit(row)}
                        title="Editar Factura"
                        type="button"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="action-btn action-btn-cancel"
                        onClick={() => onCancel(row)}
                        title="Anular Factura"
                        type="button"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M18 6L6 18M6 6l12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </>
                  ) : null}
                  {isGerente ? (
                    <button
                      className="action-btn action-btn-del"
                      onClick={() => onDelete(row)}
                      title="Eliminar Factura"
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
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="12" className="text-center">
              {filteredCount === 0
                ? filters.search ||
                  filters.fechaInicio ||
                  filters.fechaFin ||
                  filters.conSaldo ||
                  filters.estado
                  ? 'No hay facturas para los filtros seleccionados'
                  : 'No hay facturas registradas'
                : 'No hay más facturas en esta página'}
            </td>
          </tr>
        )}
      </tbody>

      {rows.length > 0 && currentPage === totalPages ? (
        <tfoot>
          <tr className="totals-row">
            <td colSpan="3" className="totals-label">
              TOTALES
            </td>
            <td className="col-money">{formatMoney(totals.subtotal)}</td>
            <td className="col-money">{formatMoney(totals.iva)}</td>
            <td className="col-money">{formatMoney(totals.total)}</td>
            <td className="col-money">{formatMoney(totals.retencion_fuente)}</td>
            <td className="col-money">{formatMoney(totals.retencion_iva)}</td>
            <td className="col-money">{formatMoney(totals.por_cobrar)}</td>
            <td className="col-money">{formatMoney(totals.total_abonos)}</td>
            <td
              className={`col-money ${totals.saldo_pendiente > 0 ? 'text-danger' : 'text-success'}`}
            >
              {formatMoney(totals.saldo_pendiente)}
            </td>
            <td className="col-actions"></td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  </div>
);

export default FacturasTable;
