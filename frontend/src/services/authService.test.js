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
