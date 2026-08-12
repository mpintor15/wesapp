import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PageHeader from './PageHeader';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderHeader = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onBack = jest.fn();
  const onRefresh = jest.fn();

  act(() => {
    root.render(<PageHeader title="Módulo" onBack={onBack} onRefresh={onRefresh} {...props} />);
  });

  return {
    container,
    onBack,
    onRefresh,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('PageHeader', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('presenta título y acciones accesibles y conserva callbacks', () => {
    const view = renderHeader({
      actions: <button type="button">Acción contextual</button>,
      refreshDisabled: true,
    });
    const buttons = view.container.querySelectorAll('button');
    const refresh = view.container.querySelector('[aria-label="Actualizar datos"]');

    expect(view.container.querySelector('h1').textContent).toBe('Módulo');
    expect(view.container.textContent).toContain('Acción contextual');
    expect(refresh.title).toBe('Actualizar datos');
    expect(refresh.disabled).toBe(true);

    act(() => buttons[0].click());
    expect(view.onBack).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  test('omite contenedor de acciones cuando no recibe acciones ni refrescar', () => {
    const view = renderHeader({ onRefresh: null });

    expect(view.container.querySelector('.page-header-actions')).toBeNull();
    expect(view.container.querySelector('.btn-back')).not.toBeNull();

    view.unmount();
  });

  test('ejecuta la acción de refrescar cuando está habilitada', () => {
    const view = renderHeader();
    const refresh = view.container.querySelector('[aria-label="Actualizar datos"]');

    act(() => refresh.click());

    expect(view.onRefresh).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
