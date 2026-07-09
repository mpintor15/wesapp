import React, { createContext, useContext, useEffect, useId, useRef } from 'react';

const AppModalContext = createContext(null);

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const AppModal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdrop = false,
  closeOnEscape = true,
  initialFocusRef,
  variant = 'dialog',
  className,
  bodyClassName,
  ariaDescribedby,
}) => {
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = `app-modal-title-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const modal = modalRef.current;
    const preferredTarget = initialFocusRef?.current;
    const focusTarget = preferredTarget || modal;

    focusTarget?.focus({ preventScroll: true });

    return () => {
      if (previouslyFocusedRef.current?.isConnected) {
        previouslyFocusedRef.current.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef, isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      onClose?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || []
    ).filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0);

    if (focusableElements.length === 0) {
      event.preventDefault();
      modalRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (document.activeElement === modalRef.current) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleBackdropClick = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
  };

  return (
    <div className="app-modal-overlay" onMouseDown={handleBackdropClick}>
      <div
        ref={modalRef}
        className={joinClassNames('app-modal', `app-modal--${size}`, className)}
        role={variant}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedby}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <AppModalContext.Provider value={{ bodyClassName, onClose, title, titleId }}>
          {children}
        </AppModalContext.Provider>
      </div>
    </div>
  );
};

const AppModalHeader = ({ children, className }) => {
  const context = useContext(AppModalContext);
  if (!context) throw new Error('AppModal.Header debe usarse dentro de AppModal');

  return (
    <div className={joinClassNames('app-modal__header', className)}>
      <h3 id={context.titleId} className="app-modal__title">
        {children || context.title}
      </h3>
      <button
        type="button"
        className="app-modal__close"
        onClick={context.onClose}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
};

const AppModalBody = ({ children, className, id }) => {
  const context = useContext(AppModalContext);
  if (!context) throw new Error('AppModal.Body debe usarse dentro de AppModal');

  return (
    <div
      id={id}
      className={joinClassNames('app-modal__body', context.bodyClassName, className)}
      data-app-modal-body
    >
      {children}
    </div>
  );
};

const AppModalFooter = ({ children, className }) => (
  <div className={joinClassNames('app-modal__footer', className)}>{children}</div>
);

AppModal.Header = AppModalHeader;
AppModal.Body = AppModalBody;
AppModal.Footer = AppModalFooter;

export default AppModal;
