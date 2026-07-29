import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import PagosTable from './PagosTable';

const renderTable = async () => {
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
        onOpenDetail={jest.fn()}
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
});
