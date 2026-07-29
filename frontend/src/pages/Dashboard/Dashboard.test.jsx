import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, flushPromises } from '../../testUtils/renderHook';
import Dashboard from './Dashboard';
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

const renderDashboard = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Dashboard />);
    await flushPromises();
  });

  return {
    container,
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes(text)
      ),
    text: () => container.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { usuario: 'gerente', tipo_usuario: 'gerente' },
      logout: jest.fn(),
      hasPermission: jest.fn(() => true),
    });
  });

  test('muestra acceso a Clientes sin cambiar la ruta ni componente visual', async () => {
    const page = await renderDashboard();

    const card = page.button('Clientes');
    expect(card).not.toBeNull();
    expect(card.className).toContain('module-card');
    expect(page.text()).toContain('Clientes, ubicaciones y organización del inventario');

    await act(async () => {
      card.click();
      await flushPromises();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/configuracion');

    page.unmount();
  });

  test('muestra Clientes por permiso de configuración aunque inventario sea falso', async () => {
    useAuth.mockReturnValue({
      user: { usuario: 'contador', tipo_usuario: 'contador' },
      logout: jest.fn(),
      hasPermission: jest.fn((permissions) =>
        permissions.some((permission) =>
          [PERMISSIONS.CUENTAS_FACTURAS_VER, PERMISSIONS.CLIENTES_VER].includes(permission)
        )
      ),
    });
    const page = await renderDashboard();

    expect(page.button('Clientes')).not.toBeNull();
    expect(page.button('Inventario')).toBeUndefined();

    page.unmount();
  });
});
