import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import CuentasTabs from './CuentasTabs';

const renderTabs = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = jest.fn();

  await act(async () => {
    root.render(
      <CuentasTabs activeTab="facturas" counts={{ facturas: 4, pagos: 2 }} onChange={onChange} />
    );
  });

  return {
    container,
    onChange,
    text: () => container.textContent,
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes(text)
      ),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('CuentasTabs', () => {
  test('no renderiza un catálogo independiente de Clientes', async () => {
    const page = await renderTabs();

    expect(page.button('Facturas')).toBeTruthy();
    expect(page.button('Pagos')).toBeTruthy();
    expect(page.button('Clientes')).toBeFalsy();
    expect(page.text()).not.toContain('Clientes');

    page.unmount();
  });
});
