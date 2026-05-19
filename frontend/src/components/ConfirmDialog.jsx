import React, { useEffect } from 'react';
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
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div
        className="modal confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="modal-header">
          <h3 id="confirm-title" className="confirm-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>

        <div id="confirm-message" className="modal-body confirm-body">
          {message && (
            typeof message === 'string'
              ? <p className="confirm-message">{message}</p>
              : <div className="confirm-message">{message}</div>
          )}
        </div>

        <div className="modal-footer confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel} type="button">
            {cancelText}
          </button>
          <button
            className={`btn btn-${variant}`}
            onClick={onConfirm}
            type="button"
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
