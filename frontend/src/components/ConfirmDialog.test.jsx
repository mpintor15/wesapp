import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act } from '../testUtils/renderHook';
import ConfirmDialog from './ConfirmDialog';

const renderDialog = async (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  await act(async () => {
    root.render(
      <ConfirmDialog
        isOpen
        title="Eliminar registro"
        message="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        processingText="Eliminando..."
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    );
  });

  return {
    container,
    onCancel,
    onConfirm,
    buttons: () => Array.from(container.querySelectorAll('button')),
    confirmButton: () =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes(props.isSubmitting ? 'Eliminando' : 'Eliminar')
      ),
    cancelButton: () =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes('Cancelar')
      ),
    overlay: () => container.querySelector('.app-modal-overlay'),
    modal: () => container.querySelector('.app-modal'),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('ConfirmDialog', () => {
  test('bloquea confirmación, cancelación, Escape y backdrop mientras procesa', async () => {
    const dialog = await renderDialog({ isSubmitting: true });

    expect(dialog.confirmButton().disabled).toBe(true);
    expect(dialog.cancelButton().disabled).toBe(true);
    expect(dialog.confirmButton().getAttribute('aria-busy')).toBe('true');

    act(() => {
      Simulate.keyDown(dialog.modal(), { key: 'Escape' });
      Simulate.mouseDown(dialog.overlay(), { target: dialog.overlay() });
      dialog.confirmButton().click();
      dialog.cancelButton().click();
    });

    expect(dialog.onConfirm).not.toHaveBeenCalled();
    expect(dialog.onCancel).not.toHaveBeenCalled();

    dialog.unmount();
  });

  test('doble click solo ejecuta si el consumidor mantiene isSubmitting', async () => {
    const dialog = await renderDialog({ isSubmitting: true });

    act(() => {
      dialog.confirmButton().click();
      dialog.confirmButton().click();
    });

    expect(dialog.onConfirm).not.toHaveBeenCalled();

    dialog.unmount();
  });
});
