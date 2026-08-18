import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import PagosTable from './PagosTable';

const renderTable = async (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <PagosTable
        rows={[
          {
            id: 9,
            fecha: '2026-01-10',
            cliente: 'Cliente QA',
            metodo_pago: 'efectivo',
            total: '25.00',
            facturas_count: 1,
          },
        ]}
        loading={false}
        filters={{}}
        sort={{ field: 'fecha', direction: 'desc' }}
        onSort={jest.fn()}
        selectedPagoId={props.selectedPagoId}
        onSelectPago={props.onSelectPago || jest.fn()}
      />
    );
  });

  return {
    container,
    text: () => container.textContent,
    buttons: () => Array.from(container.querySelectorAll('button')),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('PagosTable', () => {
  test('no muestra acciones de anular ni eliminar pago', async () => {
    const table = await renderTable();

    expect(table.text()).not.toContain('Anular pago');
    expect(table.text()).not.toContain('Eliminar pago');
    expect(table.buttons().some((button) => /Anular pago|Eliminar pago/i.test(button.title))).toBe(
      false
    );

    table.unmount();
  });

  test('selecciona la fila por click o teclado y pluraliza facturas', async () => {
    const onSelectPago = jest.fn();
    const table = await renderTable({ selectedPagoId: 9, onSelectPago });
    const row = table.container.querySelector('tbody tr');
    const chip = table.container.querySelector('.payment-invoices-chip');

    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(chip.textContent).toBe('1 factura');

    await act(async () => row.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    expect(onSelectPago).toHaveBeenCalledTimes(1);

    await act(async () =>
      row.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    );
    expect(onSelectPago).toHaveBeenCalledTimes(2);

    await act(async () =>
      row.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    );
    expect(onSelectPago).toHaveBeenCalledTimes(3);

    table.unmount();
  });
});
