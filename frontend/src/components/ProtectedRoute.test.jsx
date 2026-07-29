import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigationType } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { canAny } from '../auth/authorization';
import { MODULE_ACCESS_PERMISSIONS } from '../auth/modulePermissions';
import { PERMISSIONS } from '../auth/permissions';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderProtectedRoute = (authState, options = {}) => {
  useAuth.mockReturnValue({
    isAuthenticated: false,
    user: null,
    loading: false,
    hasPermission: jest.fn(),
    ...authState,
  });

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const initialEntries = options.initialEntries || ['/protegida'];
  const initialIndex = options.initialIndex;

  const LoginProbe = () => {
    const navigationType = useNavigationType();
    return (
      <div>
        <span data-testid="login-page">Login</span>
        <span data-testid="navigation-type">{navigationType}</span>
      </div>
    );
  };

  act(() => {
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={initialEntries}
        initialIndex={initialIndex}
      >
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/change-password" element={<div data-testid="change-password-page" />} />
          <Route path="/anterior" element={<div data-testid="previous-page" />} />
          <Route
            path="/protegida"
            element={
              <ProtectedRoute requiredPermission={options.requiredPermission}>
                <div data-testid="protected-content">Contenido protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  });

  return {
    container,
    get: (testId) => container.querySelector(`[data-testid="${testId}"]`),
    queryText: (text) =>
      Array.from(container.querySelectorAll('*')).find((node) => node.textContent === text),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('ProtectedRoute', () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('redirige a login con replace cuando el usuario no está autenticado', () => {
    const view = renderProtectedRoute({ isAuthenticated: false });

    expect(view.get('login-page')).not.toBeNull();
    expect(view.get('navigation-type')?.textContent).toBe('REPLACE');
    expect(view.get('protected-content')).toBeNull();

    view.unmount();
  });

  test('redirige a cambio de contraseña cuando el usuario tiene primer_login activo', () => {
    const view = renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 1, primer_login: true },
    });

    expect(view.get('change-password-page')).not.toBeNull();
    expect(view.get('protected-content')).toBeNull();

    view.unmount();
  });

  test('renderiza el contenido protegido cuando el usuario está autenticado y autorizado', () => {
    const hasPermission = jest.fn(() => true);
    const view = renderProtectedRoute(
      {
        isAuthenticated: true,
        user: { id: 1, primer_login: false },
        hasPermission,
      },
      { requiredPermission: 'usuarios' }
    );

    expect(view.get('protected-content')?.textContent).toBe('Contenido protegido');
    expect(hasPermission).toHaveBeenCalledWith('usuarios');

    view.unmount();
  });

  test('renderiza el contenido protegido con lista any concedida', () => {
    const hasPermission = jest.fn(() => true);
    const requiredPermission = ['usuarios.ver', 'clientes.ver'];
    const view = renderProtectedRoute(
      {
        isAuthenticated: true,
        user: { id: 1, primer_login: false },
        hasPermission,
      },
      { requiredPermission }
    );

    expect(view.get('protected-content')?.textContent).toBe('Contenido protegido');
    expect(hasPermission).toHaveBeenCalledWith(requiredPermission);

    view.unmount();
  });

  test('muestra acceso denegado y conserva el botón de volver cuando falta el permiso', () => {
    const view = renderProtectedRoute(
      {
        isAuthenticated: true,
        user: { id: 1, primer_login: false },
        hasPermission: jest.fn(() => false),
      },
      {
        initialEntries: ['/anterior', '/protegida'],
        initialIndex: 1,
        requiredPermission: 'usuarios',
      }
    );

    expect(view.queryText('Acceso Denegado')).not.toBeUndefined();
    expect(view.queryText('No tienes permisos para acceder a esta sección.')).not.toBeUndefined();
    expect(view.get('protected-content')).toBeNull();

    act(() => {
      view.queryText('Volver').click();
    });

    expect(view.get('previous-page')).not.toBeNull();

    view.unmount();
  });

  test('no permite entrar a inventario con solo permiso de ubicaciones', () => {
    const user = {
      id: 1,
      usuario: 'ubicaciones',
      tipo_usuario: 'custom',
      activo: true,
      permisos: [PERMISSIONS.INVENTARIO_UBICACIONES_VER],
    };
    const view = renderProtectedRoute(
      {
        isAuthenticated: true,
        user: { id: 1, primer_login: false },
        hasPermission: jest.fn((permissions) => canAny(user, permissions)),
      },
      { requiredPermission: MODULE_ACCESS_PERMISSIONS.inventario }
    );

    expect(view.queryText('Acceso Denegado')).not.toBeUndefined();
    expect(view.get('protected-content')).toBeNull();

    view.unmount();
  });

  test('muestra el estado de carga sin redirigir prematuramente', () => {
    const view = renderProtectedRoute({
      loading: true,
      isAuthenticated: false,
    });

    expect(view.queryText('Verificando sesión…')).not.toBeUndefined();
    expect(view.get('login-page')).toBeNull();
    expect(view.get('protected-content')).toBeNull();

    view.unmount();
  });
});
