jest.mock('./api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

import api from './api';
import authService from './authService';

describe('authService login connectivity handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('no intenta fallback local después de un error de conexión', async () => {
    api.post.mockRejectedValueOnce(new Error('Network Error'));

    const result = await authService.login('usuario', 'password');

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      usuario: 'usuario',
      password: 'password',
    });
    expect(result).toEqual({
      success: false,
      message: 'No se pudo conectar con el servidor. Intenta nuevamente.',
    });
  });

  test('verifyToken actualiza usuario cuando la sesión es válida', async () => {
    const user = { id: 1, usuario: 'ana', tipo_usuario: 'supervisor' };
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { user },
      },
    });

    const result = await authService.verifyToken();

    expect(api.get).toHaveBeenCalledWith('/auth/verify');
    expect(result).toEqual({ success: true, user });
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(user);
  });

  test('verifyToken conserva status en errores para resincronización', async () => {
    api.get.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { message: 'Acceso denegado' },
      },
    });

    const result = await authService.verifyToken();

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'Acceso denegado',
    });
  });
});

describe('authService sesión por cookie', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('login guarda solo el usuario en localStorage y nunca el token', async () => {
    const user = { id: 1, usuario: 'ana', tipo_usuario: 'supervisor' };
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { token: 'jwt-secreto', user } },
    });

    const result = await authService.login('ana', 'password');

    expect(result.success).toBe(true);
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(user);
    expect(localStorage.getItem('token')).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain('jwt-secreto');
  });

  test('logout limpia el localStorage y pide al backend expirar la cookie', () => {
    localStorage.setItem('token', 'legacy');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    api.post.mockResolvedValueOnce({ data: { success: true } });

    authService.logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  test('logout no falla si el backend no responde', async () => {
    api.post.mockRejectedValueOnce(new Error('Network Error'));

    expect(() => authService.logout()).not.toThrow();
    await Promise.resolve();
  });
});
