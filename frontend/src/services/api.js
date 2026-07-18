/**
 * api.js — Instancia central de Axios para comunicación con el backend
 *
 * Configura una instancia de Axios con la URL base del API.
 *
 * Interceptores:
 *  - Request  : Agrega automáticamente el header Authorization: Bearer <token>
 *               leyendo el token del localStorage antes de cada petición.
 *  - Response : Si el backend responde 401 (token expirado o inválido), limpia
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
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
