import { useState } from 'react';
import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';

const SalidaColaboradorModal = ({ colaborador, editable = false, onCancel, onConfirm }) => {
  const [fecha, setFecha] = useState(
    colaborador?.fecha_salida?.split('T')[0] || new Date().toISOString().slice(0, 10)
  );
  const [voluntaria, setVoluntaria] = useState(
    typeof colaborador?.salida_voluntaria === 'boolean' ? String(colaborador.salida_voluntaria) : ''
  );
  return (
    <AppModal isOpen onClose={onCancel} title="Información de salida" size="sm">
      <AppModal.Header />
      <AppModal.Body>
        <p>{colaborador?.nombres_completos}</p>
        <div className="form-group">
          <label htmlFor="salida-fecha">
            Fecha de salida {editable && <span className="required">*</span>}
          </label>
          <FilterDateInput
            id="salida-fecha"
            className="salida-fecha-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={!editable}
            required={editable}
          />
        </div>
        <div className="form-group">
          <label htmlFor="salida-voluntaria">
            Tipo de salida {editable && <span className="required">*</span>}
          </label>
          <select
            id="salida-voluntaria"
            value={voluntaria}
            onChange={(e) => setVoluntaria(e.target.value)}
            disabled={!editable}
            required={editable}
          >
            <option value="">Selecciona una opción</option>
            <option value="true">Voluntaria</option>
            <option value="false">No voluntaria</option>
          </select>
        </div>
      </AppModal.Body>
      <AppModal.Footer>
        {editable ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!fecha || !voluntaria}
            onClick={() =>
              onConfirm({ fecha_salida: fecha, salida_voluntaria: voluntaria === 'true' })
            }
          >
            Confirmar inactivación
          </button>
        ) : null}
        <button type="button" className="btn btn-modal-clear" onClick={onCancel}>
          {editable ? 'Cancelar' : 'Cerrar'}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};
export default SalidaColaboradorModal;
