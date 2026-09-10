import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SalidaColaboradorModal from './SalidaColaboradorModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const change = (element, value) => {
  const prototype =
    element.tagName === 'SELECT'
      ? globalThis.HTMLSelectElement.prototype
      : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

describe('SalidaColaboradorModal', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('confirma la salida con un booleano', () => {
    const onConfirm = jest.fn();
    act(() => {
      root.render(
        <SalidaColaboradorModal
          colaborador={{ nombres_completos: 'Ana Torres' }}
          editable
          onCancel={jest.fn()}
          onConfirm={onConfirm}
        />
      );
    });

    const select = document.querySelector('#salida-voluntaria');
    act(() => change(select, 'false'));
    const button = [...document.querySelectorAll('button')].find((item) =>
      item.textContent.includes('Confirmar inactivación')
    );
    act(() => button.click());

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ salida_voluntaria: false }));
  });
});
