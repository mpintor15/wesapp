import { useCallback, useState } from 'react';
import cuentasService from '../../../services/cuentasService';
import { getVisibleErrorMessage } from '../../../services/serviceUtils';
import useSubmitState from '../../../hooks/useSubmitState';

const useCuentasAdministrativeActions = ({ permissions, showToast, onRefresh }) => {
  const { isSubmitting: isSubmittingCancelFactura, withSubmit: withCancelFacturaSubmit } =
    useSubmitState();
  const [anulacionModal, setAnulacionModal] = useState(null);
  const [facturaToCancel, setFacturaToCancel] = useState(null);
  const [cancelDetail, setCancelDetail] = useState('');
  const [showCancelFacturaModal, setShowCancelFacturaModal] = useState(false);

  const openCancelFacturaModal = useCallback(
    (row) => {
      if (!permissions.canCancelFactura) {
        showToast('Solo un usuario Gerente puede anular facturas', 'error');
        return;
      }
      setFacturaToCancel(row);
      setCancelDetail('');
      setShowCancelFacturaModal(true);
    },
    [permissions.canCancelFactura, showToast]
  );

  const closeCancelFacturaModal = useCallback(() => {
    if (isSubmittingCancelFactura) return;
    setShowCancelFacturaModal(false);
    setFacturaToCancel(null);
    setCancelDetail('');
  }, [isSubmittingCancelFactura]);

  const confirmCancelFactura = withCancelFacturaSubmit(async (event) => {
    event.preventDefault();
    if (!permissions.canCancelFactura) {
      showToast('Solo un usuario Gerente puede anular facturas', 'error');
      return;
    }

    if (!facturaToCancel) return;
    if (!cancelDetail.trim()) {
      showToast('Debes ingresar el detalle de la anulación', 'warning');
      return;
    }

    const result = await cuentasService.cancelFactura(facturaToCancel.num_factura, {
      detalle_anulacion: cancelDetail.trim(),
    });

    if (result.success) {
      showToast('Factura anulada exitosamente', 'success');
      closeCancelFacturaModal();
      onRefresh();
    } else {
      showToast(getVisibleErrorMessage(result, 'Error al cancelar factura'), 'error');
    }
  });

  return {
    anulacionModal,
    facturaToCancel,
    cancelDetail,
    showCancelFacturaModal,
    isSubmittingCancelFactura,
    setAnulacionModal,
    openCancelFacturaModal,
    closeCancelFacturaModal,
    setCancelDetail,
    confirmCancelFactura,
  };
};

export default useCuentasAdministrativeActions;
