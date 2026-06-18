import { formatMoney } from '../utils/cuentasFormatters';

const FacturaTaxOptions = ({ values, onChange, error, preview, className = '', style }) => (
  <div className={className || undefined} style={style}>
    <div className="factura-card">
      <span className="factura-preview-title">Retenciones e IVA</span>
      <div className="modal-checkboxes">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="incluye_iva"
            checked={values.incluye_iva}
            onChange={onChange}
          />
          Incluye IVA (15%)
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="incluye_retencion_fuente"
            checked={values.incluye_retencion_fuente}
            onChange={onChange}
          />
          Retención de fuente (3%)
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="incluye_retencion_iva"
            checked={values.incluye_retencion_iva}
            onChange={onChange}
            disabled={!values.incluye_iva}
          />
          Retención de IVA (70% del IVA)
        </label>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>

    {preview ? (
      <div className="factura-preview factura-card">
        <span className="factura-preview-title">Resumen calculado</span>
        <div className="factura-preview-grid">
          <span>Subtotal</span>
          <strong>{formatMoney(preview.subtotal)}</strong>
          <span>· IVA (15%)</span>
          <strong>{formatMoney(preview.iva)}</strong>
          <span>· Ret. Fuente (3%)</span>
          <strong>{formatMoney(preview.retencionFuente)}</strong>
          <span>· Ret. IVA (70%)</span>
          <strong>{formatMoney(preview.retencionIva)}</strong>
          <span className="factura-preview-total">Por cobrar</span>
          <strong className="factura-preview-total">{formatMoney(preview.porCobrar)}</strong>
        </div>
      </div>
    ) : null}
  </div>
);

export default FacturaTaxOptions;
