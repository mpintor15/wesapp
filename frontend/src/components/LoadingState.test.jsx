import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import LoadingState from './LoadingState';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderLoadingState = (props) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<LoadingState {...props} />);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('LoadingState', () => {
  test('no renderiza nada cuando loading es false', () => {
    const { container, unmount } = renderLoadingState({ loading: false, hasRows: false });

    expect(container.textContent).toBe('');
    expect(container.querySelector('.spinner')).toBeNull();

    unmount();
  });

  test('muestra el bloque centrado cuando carga por primera vez sin filas', () => {
    const { container, unmount } = renderLoadingState({
      loading: true,
      hasRows: false,
      message: 'Cargando facturas...',
    });

    expect(container.querySelector('.loading-spinner-wrap')).not.toBeNull();
    expect(container.querySelector('.spinner')).not.toBeNull();
    expect(container.querySelector('.spinner--sm')).toBeNull();
    expect(container.textContent).toBe('Cargando facturas...');
    expect(container.querySelector('.inline-loading-indicator')).toBeNull();

    unmount();
  });

  test('muestra el indicador inline cuando refresca con filas ya visibles', () => {
    const { container, unmount } = renderLoadingState({
      loading: true,
      hasRows: true,
      refreshMessage: 'Actualizando facturas...',
    });

    expect(container.querySelector('.inline-loading-indicator')).not.toBeNull();
    expect(container.querySelector('.spinner--sm')).not.toBeNull();
    expect(container.textContent).toBe('Actualizando facturas...');
    expect(container.querySelector('.loading-spinner-wrap')).toBeNull();

    unmount();
  });

  test('usa los mensajes por defecto cuando no se especifican', () => {
    const { container, unmount } = renderLoadingState({ loading: true, hasRows: false });

    expect(container.textContent).toBe('Cargando...');

    unmount();
  });
});
