import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import CancelFacturaModal from './CancelFacturaModal';

const renderModal = async (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSubmit = jest.fn((event) => event.preventDefault());

  await act(async () => {
    root.render(
      <CancelFacturaModal
        isOpen
        factura={{ num_factura: 1001, cliente: 'Cliente QA' }}
        detail="Error de emisión"
        isSubmitting={false}
        onDetailChange={jest.fn()}
        onSubmit={onSubmit}
        onClose={jest.fn()}
        {...props}
      />
    );
  });

  return {
    container,
    text: () => container.textContent,
    confirmButton: () =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes('Confirmar anulación')
      ) ||
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes('Anulando')
      ),
    cancelButton: () =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes('Cancelar')
      ),
    textarea: () => container.querySelector('textarea'),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('CancelFacturaModal', () => {
  test('identifica factura y explica historial y abonos', async () => {
    const modal = await renderModal();

    expect(modal.text()).toContain('Anular factura');
    expect(modal.text()).toContain('Factura: #1001');
    expect(modal.text()).toContain('quedará conservada en el historial contable');
    expect(modal.text()).toContain('no admitirá nuevos abonos');

    modal.unmount();
  });

  test('bloquea controles durante la petición', async () => {
    const modal = await renderModal({ isSubmitting: true });

    expect(modal.confirmButton().disabled).toBe(true);
    expect(modal.cancelButton().disabled).toBe(true);
    expect(modal.textarea().disabled).toBe(true);

    modal.unmount();
  });
});
