import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';
import { formatDate, formatMoney } from '../utils/cuentasFormatters';

const BatchPaymentModal = ({
  isOpen,
  totalCredit,
  customerSearch,
  showCustomerDropdown,
  filteredClientes,
  customer,
  date,
  metodoPago,
  notas,
  errors,
  invoices,
  totalPendiente,
  selections,
  totalAllocated,
  remaining,
  isSubmitting,
  onTotalCreditChange,
  onCustomerSearchChange,
  onCustomerFocus,
  onCustomerSelect,
  onDateChange,
  onMetodoPagoChange,
  onNotasChange,
  onAutoDistribute,
  onClearSelections,
  onInvoiceToggle,
  onPayFull,
  onAmountChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      title="Registrar pago"
      size="lg"
      className="modal-batch-payment"
    >
      <form onSubmit={onSubmit}>
        <AppModal.Header />
        <AppModal.Body className="bp-form-scroll">
          <div className="bp-section">
            <div className="bp-fields-grid">
              <div className="form-group bp-amount-group">
                <label>Monto total</label>
                <div className="bp-amount-input-wrapper">
                  <span className="bp-amount-prefix">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={totalCredit}
                    onChange={onTotalCreditChange}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group bp-cliente-group">
                <label>Cliente</label>
                <div className="bp-cliente-search-container cliente-search-container">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={onCustomerSearchChange}
                    onFocus={onCustomerFocus}
                    placeholder="Buscar por nombre o identificación..."
                    autoComplete="off"
                  />
                  {showCustomerDropdown && customerSearch ? (
                    <div className="cliente-dropdown">
                      {filteredClientes.length > 0 ? (
                        filteredClientes.map((cliente) => (
                          <div
                            key={cliente.id}
                            className="cliente-option"
                            onClick={() => onCustomerSelect(cliente)}
                          >
                            <div className="cliente-nombre">{cliente.nombre}</div>
                            <div className="cliente-identificacion">{cliente.identificacion}</div>
                          </div>
                        ))
                      ) : (
                        <div className="cliente-option-empty">No se encontraron clientes</div>
                      )}
                    </div>
                  ) : null}
                </div>
                {customer ? (
                  <div className="selected-client-summary">
                    <div className="selected-client-row">
                      <span className="selected-client-label">Identificación</span>
                      <strong>{customer.identificacion}</strong>
                    </div>
                  </div>
                ) : null}
                {errors.cliente ? <span className="field-error">{errors.cliente}</span> : null}
              </div>

              <div className="form-group">
                <label>Fecha</label>
                <FilterDateInput name="fecha" value={date} onChange={onDateChange} />
                {errors.fecha ? <span className="field-error">{errors.fecha}</span> : null}
              </div>

              <div className="form-group">
                <label>Método</label>
                <select value={metodoPago} onChange={onMetodoPagoChange}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="form-group bp-notas-group">
                <label>
                  Notas <span className="label-optional">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={notas}
                  onChange={onNotasChange}
                  placeholder="Detalle adicional del pago..."
                  maxLength={500}
                />
                {errors.notas ? <span className="field-error">{errors.notas}</span> : null}
              </div>
            </div>
          </div>

          {customer ? (
            <div className="bp-section">
              <div className="bp-section-header">
                <div>
                  <span className="bp-section-title">Distribución en facturas</span>
                  <span className="bp-total-pendiente">
                    {invoices.length} factura{invoices.length !== 1 ? 's' : ''} ·{' '}
                    {formatMoney(totalPendiente)} pendiente
                  </span>
                </div>
                <div className="bp-quick-pills">
                  <button
                    type="button"
                    className="bp-pill"
                    onClick={onAutoDistribute}
                    title="Distribuir automáticamente según el monto ingresado"
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className="bp-pill bp-pill-clear"
                    onClick={onClearSelections}
                    title="Limpiar distribución"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {invoices.length > 0 ? (
                <>
                  <div className="bp-invoices-list">
                    {invoices.map((invoice) => {
                      const selection = selections[invoice.num_factura] || {};
                      const amountValue = parseFloat(selection.amount || 0);
                      const saldo = parseFloat(invoice.saldo_pendiente);
                      const fillPct = saldo > 0 ? Math.min(100, (amountValue / saldo) * 100) : 0;
                      const exceedsSaldo =
                        selection.selected && selection.amount && amountValue > saldo;
                      const rowError = errors[`amount_${invoice.num_factura}`];

                      return (
                        <div
                          key={invoice.num_factura}
                          className={`bp-invoice-row${selection.selected ? ' selected' : ''}${exceedsSaldo || rowError ? ' has-error' : ''}`}
                          onClick={() => onInvoiceToggle(invoice.num_factura)}
                        >
                          <div className="bp-invoice-check">
                            {selection.selected ? (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : null}
                          </div>
                          <div className="bp-invoice-body">
                            <div className="bp-invoice-meta">
                              <span className="bp-invoice-num">Factura #{invoice.num_factura}</span>
                              <span className="bp-invoice-date">
                                {formatDate(invoice.fecha_factura)}
                              </span>
                              <span className="bp-invoice-saldo">
                                Saldo: {formatMoney(invoice.saldo_pendiente)}
                              </span>
                            </div>
                            {selection.selected ? (
                              <div className="bp-invoice-progress-wrap">
                                <div className="bp-invoice-progress">
                                  <div
                                    className="bp-invoice-progress-fill"
                                    style={{ width: `${fillPct}%` }}
                                  />
                                </div>
                                <span className="bp-invoice-pct">{fillPct.toFixed(0)}%</span>
                              </div>
                            ) : null}
                            {rowError ? <span className="bp-row-error">{rowError}</span> : null}
                          </div>
                          <div className="bp-invoice-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="bp-pay-full-btn"
                              onClick={() => onPayFull(invoice)}
                              title="Pagar saldo completo"
                            >
                              Todo
                            </button>
                            <div className="money-input-wrapper bp-invoice-amount-wrapper">
                              <span className="money-input-prefix">$</span>
                              <input
                                type="number"
                                className={`bp-invoice-amount-input${exceedsSaldo || rowError ? ' error' : ''}`}
                                value={selection.amount || ''}
                                onChange={(e) =>
                                  onAmountChange(invoice.num_factura, e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                disabled={!selection.selected}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {errors.abonos ? (
                    <span className="field-error bp-abonos-error">{errors.abonos}</span>
                  ) : null}

                  <div className={`bp-progress-section${remaining < -0.01 ? ' over' : ''}`}>
                    <div className="bp-progress-labels">
                      <span>
                        Distribuido <strong>{formatMoney(totalAllocated)}</strong> de{' '}
                        <strong>{formatMoney(parseFloat(totalCredit || 0))}</strong>
                      </span>
                      {totalAllocated > 0 || remaining !== 0 ? (
                        <span
                          className={`bp-remaining-label${remaining < -0.01 ? ' negative' : remaining < 0.01 && totalAllocated > 0 ? ' done' : ' pending'}`}
                        >
                          {remaining > 0.01
                            ? `Pendiente: ${formatMoney(remaining)}`
                            : remaining < -0.01
                              ? `Excede: ${formatMoney(Math.abs(remaining))}`
                              : '✓ Completamente distribuido'}
                        </span>
                      ) : null}
                    </div>
                    <div className="bp-progress-track">
                      <div
                        className="bp-progress-fill"
                        style={{
                          width: `${
                            parseFloat(totalCredit || 0) > 0
                              ? Math.min(100, (totalAllocated / parseFloat(totalCredit)) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="bp-empty-invoices">Sin facturas con saldo pendiente</div>
              )}
            </div>
          ) : null}
        </AppModal.Body>
        <AppModal.Footer className="modal-buttons">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner spinner--sm" />
                Registrando…
              </>
            ) : (
              'Registrar pago'
            )}
          </button>
          <button
            type="button"
            className="btn btn-modal-clear"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
};

export default BatchPaymentModal;
