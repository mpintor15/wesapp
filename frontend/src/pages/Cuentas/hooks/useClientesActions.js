import { useState } from 'react';
import cuentasService from '../../../services/cuentasService';

const validateClienteForm = ({ nombre, identificacion }) => {
  const errors = {};
  if (!nombre.trim()) errors.nombre = 'Ingresa el nombre del cliente';
  if (!identificacion.trim()) errors.identificacion = 'Ingresa la identificación del cliente';
  return errors;
};

const useClientesActions = ({ showToast, onClienteCreated, onClienteDeleted }) => {
  const [loading, setLoading] = useState(false);

  const createCliente = async ({ nombre, identificacion, onValidationError, onSuccess }) => {
    setLoading(true);
    const errors = validateClienteForm({ nombre, identificacion });

    if (Object.keys(errors).length > 0) {
      onValidationError(errors);
      showToast(Object.values(errors)[0], 'error');
      setLoading(false);
      return;
    }

    const result = await cuentasService.createCliente(nombre, identificacion);
    if (result.success) {
      showToast('Cliente creado exitosamente', 'success');
      onSuccess();
      onClienteCreated();
    } else {
      showToast(result.message, 'error');
    }
    setLoading(false);
  };

  const deleteCliente = async (cliente, onSettled) => {
    if (!cliente) return;
    const result = await cuentasService.deleteCliente(cliente.id);
    if (result.success) {
      showToast('Cliente eliminado exitosamente', 'success');
      onClienteDeleted();
    } else {
      showToast(result.message, 'error');
    }
    onSettled();
  };

  return {
    loading,
    createCliente,
    deleteCliente,
  };
};

export { validateClienteForm };
export default useClientesActions;
