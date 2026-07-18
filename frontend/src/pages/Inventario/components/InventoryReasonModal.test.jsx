import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../../testUtils/renderHook';
import InventoryReasonModal from './InventoryReasonModal';

const action = {
  title: 'Eliminar administrativamente',
  confirmText: 'Eliminar administrativamente',
  entityLabel: 'Artículo',
  entityName: 'Radio portátil',
  messages: ['El historial se conservará.'],
  placeholder: 'Describe el motivo',
};

const renderModal = ({
  initialMotivo = '',
  onConfirm = jest.fn(),
  clearOnSuccess = false,
} = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const confirmSpy = onConfirm;

  const Harness = () => {
    const [motivo, setMotivo] = useState(initialMotivo);
    const [currentAction, setCurrentAction] = useState(action);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
      setIsSubmitting(true);
      const result = await confirmSpy(motivo.trim());
      setIsSubmitting(false);
      if (clearOnSuccess && result?.success) {
        setMotivo('');
        setCurrentAction(null);
      }
    };

    const handleCancel = () => {
      setMotivo('');
      setCurrentAction(null);
    };

    return (
      <InventoryReasonModal
        action={currentAction}
        isSubmitting={isSubmitting}
        motivo={motivo}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onMotivoChange={setMotivo}
      />
    );
  };

  act(() => {
    root.render(<Harness />);
  });

  return {
    container,
    textarea: () => container.querySelector('textarea'),
    confirmButton: () => Array.from(container.querySelectorAll('button')).at(-1),
    cancelButton: () =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Cancelar'
      ),
    text: () => container.textContent,
    changeMotivo: (value) => {
      const textarea = container.querySelector('textarea');
      act(() => {
        Simulate.change(textarea, { target: { value } });
      });
    },
    clickConfirm: async () => {
      await act(async () => {
        container.querySelectorAll('button')[2].click();
        await flushPromises();
      });
    },
    clickCancel: () => {
      act(() => {
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Cancelar')
          .click();
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('InventoryReasonModal', () => {
  test('valida mínimo 10 caracteres, trim y contador', () => {
    const modal = renderModal({ initialMotivo: ' corto ' });

    expect(modal.text()).toContain('El motivo debe tener al menos 10 caracteres');
    expect(modal.text()).toContain('7/500');
    expect(modal.confirmButton().disabled).toBe(true);

    modal.changeMotivo(' Motivo suficiente ');

    expect(modal.text()).toContain('Motivo válido.');
    expect(modal.text()).toContain('19/500');
    expect(modal.confirmButton().disabled).toBe(false);

    modal.unmount();
  });

  test('valida máximo 500 caracteres', () => {
    const modal = renderModal({ initialMotivo: 'a'.repeat(501) });

    expect(modal.text()).toContain('El motivo no puede exceder 500 caracteres');
    expect(modal.confirmButton().disabled).toBe(true);

    modal.unmount();
  });

  test('deshabilita confirmación mientras envía y conserva texto si falla', async () => {
    let resolveConfirm;
    const onConfirm = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        })
    );
    const modal = renderModal({ initialMotivo: 'Motivo suficiente', onConfirm });

    await act(async () => {
      modal.confirmButton().click();
      await Promise.resolve();
    });

    expect(modal.confirmButton().disabled).toBe(true);

    await act(async () => {
      resolveConfirm({ success: false });
      await flushPromises();
    });

    expect(onConfirm).toHaveBeenCalledWith('Motivo suficiente');
    expect(modal.textarea().value).toBe('Motivo suficiente');
    expect(modal.confirmButton().disabled).toBe(false);

    modal.unmount();
  });

  test('limpia después de éxito y al cancelar', async () => {
    const successModal = renderModal({
      initialMotivo: 'Motivo suficiente',
      onConfirm: jest.fn().mockResolvedValue({ success: true }),
      clearOnSuccess: true,
    });

    await successModal.clickConfirm();
    expect(successModal.textarea()).toBeNull();
    successModal.unmount();

    const cancelModal = renderModal({ initialMotivo: 'Motivo suficiente' });
    cancelModal.clickCancel();
    expect(cancelModal.textarea()).toBeNull();
    cancelModal.unmount();
  });
});
