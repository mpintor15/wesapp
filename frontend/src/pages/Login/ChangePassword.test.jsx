import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ChangePassword from './ChangePassword';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ changePassword: jest.fn(), user: { usuario: 'guardia' } }),
}));
jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ChangePassword', () => {
  test('permite mostrar y ocultar cada contraseña de forma independiente', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <ChangePassword />
        </MemoryRouter>
      )
    );

    const nueva = container.querySelector('#nueva-password');
    const confirmar = container.querySelector('#confirmar-password');
    expect(nueva.type).toBe('password');
    expect(confirmar.type).toBe('password');

    const [toggleNueva, toggleConfirmar] = container.querySelectorAll('.change-password-eye');
    expect(toggleNueva.getAttribute('aria-label')).toBe('Mostrar contraseña');

    act(() => toggleNueva.click());
    expect(nueva.type).toBe('text');
    expect(confirmar.type).toBe('password');
    expect(toggleNueva.getAttribute('aria-label')).toBe('Ocultar contraseña');

    act(() => toggleConfirmar.click());
    expect(confirmar.type).toBe('text');

    act(() => toggleNueva.click());
    expect(nueva.type).toBe('password');

    act(() => root.unmount());
    container.remove();
  });
});
