import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, flushPromises } from '../testUtils/renderHook';
import { AuthProvider, useAuth } from './AuthContext';
import authService from '../services/authService';
import { AUTH_PERMISSIONS_CHANGED_EVENT } from '../services/api';
import {
  getInventoryPermissions,
  INVENTORY_ACTIONS,
} from '../pages/Inventario/utils/inventarioPermissions';

jest.mock('../services/authService', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    verifyToken: jest.fn(),
  },
}));

const gerente = { id: 1, usuario: 'ana', tipo_usuario: 'gerente' };
const supervisor = { id: 1, usuario: 'ana', tipo_usuario: 'supervisor' };
const secretario = { id: 1, usuario: 'ana', tipo_usuario: 'secretario' };
const contador = { id: 1, usuario: 'ana', tipo_usuario: 'contador' };

const renderAuth = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const Probe = () => {
    const { user, isAuthenticated, hasPermission } = useAuth();
    const permissions = getInventoryPermissions(user);
    return (
      <div>
        <span data-testid="role">{user?.tipo_usuario || 'none'}</span>
        <span data-testid="authenticated">{String(isAuthenticated)}</span>
        <span data-testid="delete-article">
          {String(permissions.can(INVENTORY_ACTIONS.ARTICULOS_DELETE_ADMIN))}
        </span>
        <span data-testid="regenerate-pdf">
          {String(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_REGENERATE))}
        </span>
        <span data-testid="void-movement">
          {String(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_VOID))}
        </span>
        <span data-testid="download-pdf">
          {String(permissions.can(INVENTORY_ACTIONS.MOVIMIENTOS_PDF_DOWNLOAD))}
        </span>
        <span data-testid="can-access">{String(permissions.canAccessInventory)}</span>
        <span data-testid="can-configuracion">{String(hasPermission('configuracion'))}</span>
      </div>
    );
  };

  act(() => {
    root.render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });

  return {
    get: (id) => container.querySelector(`[data-testid="${id}"]`)?.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const setStoredSession = (user = gerente) => {
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify(user));
};

const dispatchPermissionChange = () => {
  window.dispatchEvent(new CustomEvent(AUTH_PERMISSIONS_CHANGED_EVENT));
};

describe('AuthProvider permission resync', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('403 de permisos dispara una sola verificación simultánea y actualiza el usuario', async () => {
    setStoredSession(gerente);
    authService.verifyToken.mockResolvedValueOnce({ success: true, user: gerente });
    const view = renderAuth();
    await flushPromises();
    authService.verifyToken.mockClear();

    let resolveResync;
    authService.verifyToken.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResync = resolve;
      })
    );

    act(() => {
      dispatchPermissionChange();
      dispatchPermissionChange();
      dispatchPermissionChange();
      dispatchPermissionChange();
      dispatchPermissionChange();
    });

    expect(authService.verifyToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveResync({ success: true, user: supervisor });
      await flushPromises();
    });

    expect(view.get('role')).toBe('supervisor');
    expect(view.get('delete-article')).toBe('false');
    expect(view.get('regenerate-pdf')).toBe('false');
    expect(view.get('void-movement')).toBe('true');
    expect(view.get('download-pdf')).toBe('true');
    expect(view.get('authenticated')).toBe('true');
    expect(authService.logout).not.toHaveBeenCalled();

    view.unmount();
  });

  test('verify 403 no hace logout, no hace recursión y libera el estado interno', async () => {
    setStoredSession(gerente);
    authService.verifyToken.mockResolvedValueOnce({ success: true, user: gerente });
    const view = renderAuth();
    await flushPromises();
    authService.verifyToken.mockClear();

    authService.verifyToken.mockResolvedValueOnce({ success: false, status: 403 });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(view.get('role')).toBe('gerente');
    expect(authService.logout).not.toHaveBeenCalled();
    expect(authService.verifyToken).toHaveBeenCalledTimes(1);

    authService.verifyToken.mockResolvedValueOnce({ success: true, user: supervisor });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(authService.verifyToken).toHaveBeenCalledTimes(2);
    expect(view.get('role')).toBe('supervisor');

    view.unmount();
  });

  test('verify 401 conserva el flujo actual de sesión expirada', async () => {
    setStoredSession(gerente);
    authService.verifyToken.mockResolvedValueOnce({ success: true, user: gerente });
    const view = renderAuth();
    await flushPromises();
    authService.verifyToken.mockClear();

    authService.verifyToken.mockResolvedValueOnce({ success: false, status: 401 });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(view.get('role')).toBe('none');
    expect(view.get('authenticated')).toBe('false');

    view.unmount();
  });

  test('error de red no cierra sesión y permite una verificación futura', async () => {
    setStoredSession(gerente);
    authService.verifyToken.mockResolvedValueOnce({ success: true, user: gerente });
    const view = renderAuth();
    await flushPromises();
    authService.verifyToken.mockClear();

    authService.verifyToken.mockResolvedValueOnce({ success: false, message: 'Network Error' });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(authService.logout).not.toHaveBeenCalled();
    expect(view.get('role')).toBe('gerente');

    authService.verifyToken.mockResolvedValueOnce({ success: true, user: supervisor });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(view.get('role')).toBe('supervisor');

    view.unmount();
  });

  test('secretario y contador no obtienen permisos adicionales al resincronizar', async () => {
    setStoredSession(gerente);
    authService.verifyToken.mockResolvedValueOnce({ success: true, user: gerente });
    const view = renderAuth();
    await flushPromises();
    authService.verifyToken.mockClear();

    authService.verifyToken.mockResolvedValueOnce({ success: true, user: secretario });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(view.get('role')).toBe('secretario');
    expect(view.get('can-configuracion')).toBe('true');
    expect(view.get('download-pdf')).toBe('true');
    expect(view.get('void-movement')).toBe('false');
    expect(view.get('delete-article')).toBe('false');

    authService.verifyToken.mockResolvedValueOnce({ success: true, user: contador });
    act(dispatchPermissionChange);
    await flushPromises();

    expect(view.get('role')).toBe('contador');
    expect(view.get('can-access')).toBe('false');
    expect(view.get('can-configuracion')).toBe('true');
    expect(view.get('download-pdf')).toBe('false');

    view.unmount();
  });

  test('permiso explícito de clientes abre configuración sin inventario', async () => {
    const clienteReader = {
      id: 2,
      usuario: 'cliente-reader',
      tipo_usuario: 'custom',
      permisos: ['clientes.ver'],
    };
    setStoredSession(clienteReader);
    authService.verifyToken.mockResolvedValueOnce({ success: true, user: clienteReader });
    const view = renderAuth();
    await flushPromises();

    expect(view.get('can-configuracion')).toBe('true');
    expect(view.get('can-access')).toBe('false');

    view.unmount();
  });
});
