import AppModal from '../../../components/AppModal';
import { formatDateTime } from '../utils/cuentasFormatters';

const AnulacionDetailModal = ({ factura, onClose }) => {
  if (!factura) return null;

  return (
    <AppModal
      isOpen={Boolean(factura)}
      onClose={onClose}
      closeOnBackdrop
      title={`Detalle de Anulación — Factura #${factura.num_factura}`}
      size="sm"
      className="modal-anulacion"
      bodyClassName="anulacion-body"
    >
      <AppModal.Header />
      <AppModal.Body>
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
      </AppModal.Body>
      <AppModal.Footer>
        <button type="button" className="btn btn-modal-clear" onClick={onClose}>
          Cerrar
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default AnulacionDetailModal;
