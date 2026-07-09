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
 *   variant      {string}   "danger" | "primary"  — styles the confirm button
 *   onConfirm    {function}
 *   onCancel     {function}
 */
const ConfirmDialog = ({
  isOpen,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const confirmButtonRef = useRef(null);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      variant="alertdialog"
      ariaDescribedby="confirm-message"
      closeOnBackdrop
      initialFocusRef={confirmButtonRef}
      className="confirm-dialog"
    >
      <AppModal.Header />
      <AppModal.Body id="confirm-message" className="confirm-body">
        {message &&
          (typeof message === 'string' ? (
            <p className="confirm-message">{message}</p>
          ) : (
            <div className="confirm-message">{message}</div>
          ))}
      </AppModal.Body>
      <AppModal.Footer className="confirm-actions">
        <button className="btn btn-secondary" onClick={onCancel} type="button">
          {cancelText}
        </button>
        <button
          ref={confirmButtonRef}
          className={`btn btn-${variant}`}
          onClick={onConfirm}
          type="button"
        >
          {confirmText}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
};

export default ConfirmDialog;
