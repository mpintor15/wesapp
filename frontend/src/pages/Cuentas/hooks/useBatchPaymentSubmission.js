import { useCallback } from 'react';
import cuentasService from '../../../services/cuentasService';
import useSubmitState from '../../../hooks/useSubmitState';
import { validateBatchPaymentForm } from '../utils/cuentasBatchPayment';

const useBatchPaymentSubmission = ({ batchPayment, showToast, onCreated }) => {
  const { isSubmitting, withSubmit } = useSubmitState();

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      const { errors, selectedAbonos } = validateBatchPaymentForm({
        customer: batchPayment.customer,
        date: batchPayment.date,
        totalCredit: batchPayment.totalCredit,
        notas: batchPayment.notas,
        invoices: batchPayment.invoices,
        selections: batchPayment.selections,
        totalPendiente: batchPayment.totalPendiente,
        remaining: batchPayment.remaining,
      });
      if (Object.keys(errors).length > 0) {
        batchPayment.setErrors(errors);
        const firstError = Object.values(errors)[0];
        showToast(firstError, 'error');
        return;
      }

      const result = await cuentasService.createBatchAbono({
        cliente_id: batchPayment.customer.id,
        fecha: batchPayment.date,
        metodo_pago: batchPayment.metodoPago,
        notas: batchPayment.notas.trim() || null,
        abonos: selectedAbonos,
      });

      if (result.success) {
        showToast(result.message || 'Pagos registrados exitosamente', 'success');
        batchPayment.close();
        await onCreated();
      } else {
        showToast(result.message, 'error');
      }
    },
    [batchPayment, onCreated, showToast]
  );

  return {
    isSubmitting,
    handleSubmit: withSubmit(submit),
  };
};

export default useBatchPaymentSubmission;
