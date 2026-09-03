import React, { useRef } from 'react';
import AppModal from './AppModal';
import './ConfirmDialog.css';

/**
 * Styled confirmation dialog — replaces native window.confirm().
 *
 * Props:
 *   isOpen       {boolean}
 *   title        {string}
 *   message      {string|ReactNode}
 *   confirmText  {string}   default "Confirmar"
 *   cancelText   {string}   default "Cancelar"
 *   processingText {string}
 *   variant      {string}   "danger" | "primary"  — styles the confirm button
 *   onConfirm    {function}
 *   onCancel     {function}
 *   isSubmitting {boolean}
 */
const ConfirmDialog = ({
  isOpen,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  processingText,
  variant = 'danger',
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  const confirmButtonRef = useRef(null);
  const visibleConfirmText = isSubmitting ? processingText || confirmText : confirmText;
  const handleConfirm = () => {
    if (isSubmitting) return;
    onConfirm?.();
  };
  const handleCancel = () => {
    if (isSubmitting) return;
    onCancel?.();
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="sm"
      variant="alertdialog"
      ariaDescribedby="confirm-message"
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      closeButtonDisabled={isSubmitting}
      initialFocusRef={confirmButtonRef}
      className="confirm-dialog"
    >
      <AppModal.Header />
      <AppModal.Body id="confirm-message" className="confirm-body" aria-busy={isSubmitting}>
        {message &&
          (typeof message === 'string' ? (
            <p className="confirm-message">{message}</p>
          ) : (
            <div className="confirm-message">{message}</div>
          ))}
      </AppModal.Body>
      <AppModal.Footer className="confirm-actions">
        <button
          className="btn btn-secondary"
          onClick={handleCancel}
          type="button"
          disabled={isSubmitting}
        >
          {cancelText}
        </button>
        <button
          ref={confirmButtonRef}
          className={`btn btn-${variant}`}
          onClick={handleConfirm}
          type="button"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          aria-label={visibleConfirmText}
        >
          {isSubmitting && <span className="spinner spinner--sm" />}
          {visibleConfirmText}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default ConfirmDialog;
