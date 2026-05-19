/**
 * authService.js — Servicio de autenticación del frontend
 *
 * Encapsula las llamadas al API de autenticación y la gestión del
 * token/usuario en localStorage. Es consumido por AuthContext.jsx.
 *
 *  - login(usuario, password)               : POST /auth/login. Si tiene éxito
 *                                             guarda token y datos del usuario.
 *  - changePassword(nueva, confirmar)       : POST /auth/change-password. Actualiza
 *                                             el campo primer_login en localStorage.
 *  - verifyToken()                          : GET /auth/verify. Refresca los datos
 *                                             del usuario con el token actual.
 *  - logout()                               : Elimina token y usuario del localStorage.
 */
import axios from 'axios';
import api, { API_URL } from './api';
import { extractError } from './serviceUtils';

const getFallbackApiUrls = () => {
  const urls = [
    API_URL,
    'http://localhost:3000/api',
    'http://127.0.0.1:3000/api',
    'http://localhost:3001/api',
    'http://127.0.0.1:3001/api'
  ];

  return [...new Set(urls.map((value) => String(value || '').trim()).filter(Boolean))];
};

const tryLoginFallback = async (usuario, password) => {
  const urls = getFallbackApiUrls();

  for (const baseURL of urls) {
    try {
      const response = await axios.post(
        `${baseURL}/auth/login`,
        { usuario, password },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000
        }
      );

      if (response?.data?.success) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        return { success: false, message: 'Usuario o contraseña incorrectos' };
      }
    }
  }

  return null;
};

const authService = {
  /**
   * Login de usuario
   */
  login: async (usuario, password) => {
    try {
      const response = await api.post('/auth/login', {
        usuario,
        password
      });
      
      if (response.data.success) {
        const { token, user } = response.data.data;
        
        // Guardar token y usuario en localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { success: true, data: response.data.data };
      }
      
      return { success: false, message: response.data.message };
    } catch (error) {
      if (error?.response?.status === 401) {
        return { success: false, message: 'Usuario o contraseña incorrectos' };
      }

      if (!error?.response) {
        const fallbackResult = await tryLoginFallback(usuario, password);
        if (fallbackResult) {
          return fallbackResult;
        }

        return {
          success: false,
          message: 'No se pudo conectar con el servidor. Intenta nuevamente.'
        };
      }

      return {
        success: false,
        message: extractError(error, 'Error al iniciar sesión')
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
        confirmar_password
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
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al cambiar contraseña')
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
      return { success: false };
    }
  },

  /**
   * Logout
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export default authService;
