import FacturaTaxOptions from './FacturaTaxOptions';

const CreateFacturaModal = ({
  isOpen,
  formData,
  facturaErrors,
  numFacturaError,
  clienteSearch,
  showClienteDropdown,
  filteredClientes,
  selectedCliente,
  shouldShowCalculation,
  preview,
  isSubmitting,
  onFormChange,
  onClienteSearchChange,
  onClienteFocus,
  onClienteSelect,
  onFlushNumericInputs,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-factura" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear nueva factura</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-form-grid">
            <div className="form-group">
              <label>N° Factura</label>
              <input
                type="number"
                name="num_factura"
                value={formData.num_factura}
                onChange={onFormChange}
                onBlur={onFlushNumericInputs}
                placeholder="Ej: 1006"
                autoFocus
                step="1"
              />
              {numFacturaError ? <span className="field-error">{numFacturaError}</span> : null}
            </div>
            <div className="form-group cliente-search-group">
              <label>Cliente</label>
              <div className="cliente-search-container">
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={onClienteSearchChange}
                  onFocus={onClienteFocus}
                  placeholder="Buscar cliente..."
                  autoComplete="off"
                />
                {showClienteDropdown && clienteSearch ? (
                  <div className="cliente-dropdown">
                    {filteredClientes.length > 0 ? (
                      filteredClientes.map((cliente) => (
                        <div
                          key={cliente.id}
                          className="cliente-option"
                          onClick={() => onClienteSelect(cliente)}
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
              {selectedCliente ? (
                <div className="selected-client-summary">
                  <div className="selected-client-row">
                    <span className="selected-client-label">Identificación</span>
                    <strong>{selectedCliente.identificacion}</strong>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input
                type="date"
                name="fecha_factura"
                value={formData.fecha_factura}
                onChange={onFormChange}
              />
            </div>
            <div className="form-group">
              <label>Subtotal</label>
              <div className="money-input-wrapper">
                <span className="money-input-prefix">$</span>
                <input
                  type="number"
                  name="valor_factura"
                  step="0.01"
                  value={formData.valor_factura}
                  onChange={onFormChange}
                  onBlur={onFlushNumericInputs}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {shouldShowCalculation ? (
            <FacturaTaxOptions
              values={formData}
              onChange={onFormChange}
              error={facturaErrors.incluye_retencion_iva}
              preview={preview}
              className="factura-calc-sections modal-checkboxes-section--animated"
            />
          ) : null}

          <div className="modal-buttons">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner spinner--sm" />
                  Creando…
                </>
              ) : (
                'Crear factura'
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFacturaModal;
