/**
 * authService.js — Servicio de autenticación del frontend
 *
 * Encapsula las llamadas al API de autenticación y la gestión del
 * datos del usuario en localStorage. El token de sesión vive en una cookie
 * HttpOnly que gestiona el backend. Es consumido por AuthContext.jsx.
 *
 *  - login(usuario, password)               : POST /auth/login. Si tiene éxito
 *                                             guarda los datos del usuario.
 *  - changePassword(nueva, confirmar)       : POST /auth/change-password. Actualiza
 *                                             el campo primer_login en localStorage.
 *  - verifyToken()                          : GET /auth/verify. Refresca los datos
 *                                             del usuario con la sesión actual.
 *  - logout()                               : Cierra la sesión en el backend (borra
 *                                             la cookie) y limpia el localStorage.
 */
import api from './api';
import { extractError } from './serviceUtils';

const authService = {
  /**
   * Login de usuario
   */
  login: async (usuario, password) => {
    try {
      const response = await api.post('/auth/login', {
        usuario,
        password,
      });

      if (response.data.success) {
        const { user } = response.data.data;

        // El token viaja en la cookie HttpOnly; aquí solo se guarda el usuario.
        localStorage.setItem('user', JSON.stringify(user));

        return { success: true, data: response.data.data };
      }

      return { success: false, message: response.data.message };
    } catch (error) {
      if (error?.response?.status === 401) {
        return { success: false, message: 'Usuario o contraseña incorrectos' };
      }

      if (!error?.response) {
        return {
          success: false,
          message: 'No se pudo conectar con el servidor. Intenta nuevamente.',
        };
      }

      return {
        success: false,
        message: extractError(error, 'Error al iniciar sesión'),
      };
    }
  },

  /**
   * Cambiar contraseña
   */
  changePassword: async (nueva_password, confirmar_password) => {
    try {
      const response = await api.post('/auth/change-password', {
        nueva_password,
        confirmar_password,
      });

      if (response.data.success) {
        // Actualizar el primer_login del usuario en localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          localStorage.setItem('user', JSON.stringify({ ...user, primer_login: false }));
        }
      }

      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al cambiar contraseña'),
      };
    }
  },

  /**
   * Verificar token
   */
  verifyToken: async () => {
    try {
      const response = await api.get('/auth/verify');

      if (response.data.success) {
        // Actualizar usuario en localStorage
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        return { success: true, user: response.data.data.user };
      }

      return { success: false };
    } catch (error) {
      return {
        success: false,
        status: error?.response?.status,
        message: extractError(error, 'Error al verificar sesión'),
      };
    }
  },

  /**
   * Logout
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Mejor esfuerzo: pide al backend expirar la cookie de sesión.
    (async () => {
      try {
        await api.post('/auth/logout');
      } catch {
        // Sin conexión: la cookie expira sola al vencer el token.
      }
    })();
  },
};

export default authService;
