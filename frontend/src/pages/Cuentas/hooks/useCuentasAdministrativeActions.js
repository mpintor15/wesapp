import { useCallback, useState } from 'react';
import cuentasService from '../../../services/cuentasService';
import useSubmitState from '../../../hooks/useSubmitState';

const useCuentasAdministrativeActions = ({ permissions, showToast, onRefresh }) => {
  const { isSubmitting: isSubmittingCancelFactura, withSubmit: withCancelFacturaSubmit } =
    useSubmitState();
  const [anulacionModal, setAnulacionModal] = useState(null);
  const [selectedPago, setSelectedPago] = useState(null);
  const [pagoToDelete, setPagoToDelete] = useState(null);
  const [facturaToCancel, setFacturaToCancel] = useState(null);
  const [facturaToDelete, setFacturaToDelete] = useState(null);
  const [cancelDetail, setCancelDetail] = useState('');
  const [showCancelFacturaModal, setShowCancelFacturaModal] = useState(false);

  const requestDeleteFactura = useCallback(
    (row) => {
      if (!permissions.canDeleteFactura) {
        showToast('Solo un usuario Gerente puede eliminar facturas', 'error');
        return;
      }
      setFacturaToDelete(row);
    },
    [permissions.canDeleteFactura, showToast]
  );

  const confirmDeleteFactura = useCallback(async () => {
    if (!permissions.canDeleteFactura) {
      showToast('Solo un usuario Gerente puede eliminar facturas', 'error');
      return;
    }
    if (!facturaToDelete?.num_factura) return;
    const result = await cuentasService.deleteFactura(facturaToDelete.num_factura);
    if (result.success) {
      showToast('Factura eliminada', 'success');
      onRefresh();
    } else {
      showToast(result.message, 'error');
    }
    setFacturaToDelete(null);
  }, [facturaToDelete, onRefresh, permissions.canDeleteFactura, showToast]);

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
    setShowCancelFacturaModal(false);
    setFacturaToCancel(null);
    setCancelDetail('');
  }, []);

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
      showToast(result.message, 'error');
    }
  });

  const confirmDeletePago = useCallback(async () => {
    if (!pagoToDelete?.id) return;
    const result = await cuentasService.deletePago(pagoToDelete.id);
    if (result.success) {
      showToast('Pago eliminado exitosamente', 'success');
      setPagoToDelete(null);
      await onRefresh();
    } else {
      showToast(result.message, 'error');
    }
  }, [onRefresh, pagoToDelete, showToast]);

  return {
    anulacionModal,
    selectedPago,
    pagoToDelete,
    facturaToCancel,
    facturaToDelete,
    cancelDetail,
    showCancelFacturaModal,
    isSubmittingCancelFactura,
    setAnulacionModal,
    openPagoDetailModal: setSelectedPago,
    closePagoDetailModal: () => setSelectedPago(null),
    requestDeletePago: setPagoToDelete,
    cancelDeletePago: () => setPagoToDelete(null),
    requestDeleteFactura,
    cancelDeleteFactura: () => setFacturaToDelete(null),
    confirmDeleteFactura,
    openCancelFacturaModal,
    closeCancelFacturaModal,
    setCancelDetail,
    confirmCancelFactura,
    confirmDeletePago,
  };
};

export default useCuentasAdministrativeActions;
