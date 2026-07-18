import { useCallback, useState } from 'react';
import cuentasService from '../../../services/cuentasService';
import useSubmitState from '../../../hooks/useSubmitState';
import {
  applyEditFacturaFieldChange,
  buildEditFacturaFormData,
  buildUpdateFacturaPayload,
  validateEditFacturaForm,
} from '../utils/facturaEditing';

const useFacturaEditing = ({ canEditFactura, showToast, onUpdated }) => {
  const { isSubmitting, withSubmit } = useSubmitState();
  const [isOpen, setIsOpen] = useState(false);
  const [factura, setFactura] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const open = useCallback(
    (row) => {
      if (!canEditFactura) {
        showToast('Solo un usuario Gerente puede editar facturas', 'error');
        return;
      }
      setFactura(row);
      setFormData(buildEditFacturaFormData(row));
      setErrors({});
      setIsOpen(true);
    },
    [canEditFactura, showToast]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setFactura(null);
    setFormData({});
    setErrors({});
  }, []);

  const handleFormChange = useCallback((event) => {
    const { name } = event.target;
    setFormData((prev) => applyEditFacturaFieldChange(prev, event.target));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  }, []);

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!canEditFactura) {
        showToast('Solo un usuario Gerente puede editar facturas', 'error');
        return;
      }
      if (!factura) return;

      const validationMessage = validateEditFacturaForm(formData);
      if (validationMessage) {
        showToast(validationMessage, 'error');
        return;
      }

      const result = await cuentasService.updateFactura(
        factura.num_factura,
        buildUpdateFacturaPayload(formData)
      );

      if (result.success) {
        showToast('Factura actualizada exitosamente', 'success');
        close();
        onUpdated();
      } else {
        showToast(result.message, 'error');
      }
    },
    [canEditFactura, close, factura, formData, onUpdated, showToast]
  );

  return {
    isOpen,
    factura,
    formData,
    errors,
    isSubmitting,
    open,
    close,
    handleFormChange,
    handleSubmit: withSubmit(submit),
  };
};

export default useFacturaEditing;
