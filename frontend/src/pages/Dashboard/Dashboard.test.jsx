import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, flushPromises } from '../../testUtils/renderHook';
import Dashboard from './Dashboard';
import { useAuth } from '../../context/AuthContext';
import { canAny } from '../../auth/authorization';
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
    header: () => container.querySelector('.dashboard-header'),
    logo: () => container.querySelector('.header-logo img'),
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

    expect(page.header().className).toContain('brand-header');
    expect(page.logo()).toEqual(
      expect.objectContaining({
        alt: 'WES Security Cía. Ltda.',
      })
    );

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

  test('mantiene la confirmación antes de cerrar sesión', async () => {
    const logout = jest.fn();
    useAuth.mockReturnValue({
      user: { usuario: 'gerente', tipo_usuario: 'gerente' },
      logout,
      hasPermission: jest.fn(() => true),
    });
    const page = await renderDashboard();

    await act(async () => {
      page.button('Cerrar sesión').click();
      await flushPromises();
    });

    const confirmButton = page.container.querySelector('.confirm-dialog .btn-danger');
    expect(confirmButton).not.toBeNull();
    expect(logout).not.toHaveBeenCalled();

    await act(async () => {
      confirmButton.click();
      await flushPromises();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');

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

  test('permiso de ubicaciones no muestra tarjeta de Inventario pero mantiene Clientes', async () => {
    const user = {
      id: 1,
      usuario: 'ubicaciones',
      tipo_usuario: 'custom',
      activo: true,
      permisos: [PERMISSIONS.INVENTARIO_UBICACIONES_VER],
    };
    useAuth.mockReturnValue({
      user,
      logout: jest.fn(),
      hasPermission: jest.fn((permissions) => canAny(user, permissions)),
    });
    const page = await renderDashboard();

    expect(page.button('Clientes')).not.toBeNull();
    expect(page.button('Inventario')).toBeUndefined();

    page.unmount();
  });
});
