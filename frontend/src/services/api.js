/**
 * api.js — Instancia central de Axios para comunicación con el backend
 *
 * Configura una instancia de Axios con la URL base del API (variable de
 * entorno REACT_APP_API_URL o http://localhost:3000/api por defecto).
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

// URL base del backend
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Instancia de Axios configurada
const api = axios.create({
  baseURL: API_URL,
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
    // Si el token expiró o es inválido
    if (error.response?.status === 401) {
      // Limpiar localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirigir al login si no estamos ya ahí
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;