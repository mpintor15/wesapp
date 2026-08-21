import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Bitacoras from './Bitacoras';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderBitacoras = (permissions) => {
  useAuth.mockReturnValue({
    hasPermission: jest.fn((permission) => permissions.includes(permission)),
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => root.render(<Bitacoras />));

  return {
    container,
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === text
      ),
    activeTab: () => container.querySelector('[role="tab"][aria-selected="true"]'),
    panel: () => container.querySelector('[role="tabpanel"]'),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('Bitacoras', () => {
  beforeEach(() => jest.clearAllMocks());

  test('muestra únicamente Registrar y lo activa con permiso de creación', () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);

    expect(view.button('Registrar')).not.toBeUndefined();
    expect(view.button('Historial')).toBeUndefined();
    expect(view.activeTab().textContent).toBe('Registrar');
    expect(view.panel().getAttribute('aria-labelledby')).toBe('bitacoras-tab-registrar');

    view.unmount();
  });

  test('muestra únicamente Historial y lo activa con permiso de consulta', () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_HISTORIAL_VER]);

    expect(view.button('Registrar')).toBeUndefined();
    expect(view.button('Historial')).not.toBeUndefined();
    expect(view.activeTab().textContent).toBe('Historial');

    view.unmount();
  });

  test('muestra ambos tabs y permite navegación accesible por teclado', () => {
    const view = renderBitacoras([
      PERMISSIONS.BITACORAS_REGISTRO_CREAR,
      PERMISSIONS.BITACORAS_HISTORIAL_VER,
    ]);

    expect(view.activeTab().textContent).toBe('Registrar');
    expect(view.button('Registrar').getAttribute('role')).toBe('tab');
    expect(view.container.querySelector('[role="tablist"]')).not.toBeNull();

    act(() => {
      view
        .button('Registrar')
        .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(view.activeTab().textContent).toBe('Historial');
    expect(document.activeElement).toBe(view.button('Historial'));

    view.unmount();
  });

  test('sin permisos no muestra tabs ni contenido funcional', () => {
    const view = renderBitacoras([]);

    expect(view.container.querySelector('[role="tablist"]')).toBeNull();
    expect(view.panel()).toBeNull();
    expect(view.container.textContent).toContain('Acceso no disponible');

    view.unmount();
  });

  test('Volver navega al Dashboard', () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);

    act(() => view.button('Volver').click());
    expect(mockNavigate).toHaveBeenCalledWith('/');

    view.unmount();
  });
});
