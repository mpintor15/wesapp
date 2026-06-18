import { formatDateTime } from '../utils/cuentasFormatters';

const AnulacionDetailModal = ({ factura, onClose }) => {
  if (!factura) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-anulacion" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Detalle de Anulación — Factura #{factura.num_factura}</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="modal-body anulacion-body">
          <div className="anulacion-meta">
            <span className="anulacion-meta-label">Cliente</span>
            <span>{factura.cliente}</span>
            <span className="anulacion-meta-label">Fecha de anulación</span>
            <span>{formatDateTime(factura.fecha_anulacion)}</span>
          </div>
          <div className="anulacion-detalle">
            <span className="anulacion-meta-label">Motivo</span>
            <p>{factura.detalle_anulacion || 'No se registró un detalle para esta anulación.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnulacionDetailModal;
