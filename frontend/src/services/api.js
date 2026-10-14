/**
 * api.js — Instancia central de Axios para comunicación con el backend
 *
 * Configura una instancia de Axios con la URL base del API.
 *
 * Interceptores:
 *  - Sesión   : El JWT viaja en una cookie HttpOnly (withCredentials), que el
 *               JavaScript de la página no puede leer. Cada petición envía el
 *               header X-Requested-With, exigido por el backend contra CSRF.
 *  - Response : Si el backend responde 401 (sesión expirada o inválida), limpia
 *               el localStorage y redirige al usuario a /login.
 *
 * Todos los servicios del frontend importan esta instancia para realizar
 * sus llamadas HTTP, garantizando autenticación y manejo de errores uniforme.
 */
import axios from 'axios';
import {
  AUTH_ERROR_CODES,
  getAuthErrorCode,
  isPermissionDeniedAuthError,
  isSessionExpiredAuthError,
} from './authErrorClassifier';

const AUTH_EXPIRED_EVENT = 'wesapp:auth-expired';
const AUTH_PERMISSIONS_CHANGED_EVENT = 'wesapp:auth-permissions-changed';

const isAuthVerificationRequest = (error) => {
  const url = String(error.config?.url || '');
  return url.includes('/auth/verify');
};

const shouldResyncUserAfterForbidden = (error) => {
  const status = error.response?.status;

  if (status !== 403) return false;
  if (isAuthVerificationRequest(error)) return false;

  return isPermissionDeniedAuthError(error);
};

// URL base del backend
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Instancia de Axios configurada
const api = axios.create({
  baseURL: API_URL,
  timeout: 12000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (isSessionExpiredAuthError(error)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    } else if (shouldResyncUserAfterForbidden(error)) {
      window.dispatchEvent(new CustomEvent(AUTH_PERMISSIONS_CHANGED_EVENT));
    }

    return Promise.reject(error);
  }
);

export default api;
export {
  AUTH_ERROR_CODES,
  AUTH_EXPIRED_EVENT,
  AUTH_PERMISSIONS_CHANGED_EVENT,
  getAuthErrorCode,
  shouldResyncUserAfterForbidden,
};
export { API_URL };
