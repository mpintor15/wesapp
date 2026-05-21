import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import authService from '../services/authService';
import { AUTH_EXPIRED_EVENT } from '../services/api';

const AuthContext = createContext(null);

const ROLE_PERMISSIONS = {
  gerente:       ['cuentas', 'inventario', 'personal', 'usuarios', 'crear_articulo', 'eliminar_articulo', 'dar_baja_articulo', 'crear_movimiento', 'exportar'],
  secretario:    ['cuentas', 'inventario', 'personal', 'crear_articulo', 'dar_baja_articulo', 'crear_movimiento', 'exportar'],
  supervisor:    ['inventario', 'personal', 'crear_articulo', 'dar_baja_articulo', 'crear_movimiento', 'exportar'],
  contador:      ['cuentas', 'exportar'],
};

const parseStoredUser = () => {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (e) {
    console.error('Error al leer usuario del localStorage:', e);
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(parseStoredUser);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('token')));

  const clearSession = useCallback(() => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const result = await authService.verifyToken();
          if (result.success) {
            setUser(result.user);
            setIsAuthenticated(true);
          } else {
            clearSession();
          }
        } catch (e) {
          console.error('Error al verificar token:', e);
          clearSession();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [clearSession]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    globalThis.addEventListener(AUTH_EXPIRED_EVENT, handleUnauthorized);
    return () => globalThis.removeEventListener(AUTH_EXPIRED_EVENT, handleUnauthorized);
  }, [clearSession]);

  const login = useCallback(async (usuario, password) => {
    const result = await authService.login(usuario, password);
    if (result.success) {
      setUser(result.data.user);
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const changePassword = useCallback(async (nueva_password, confirmar_password) => {
    const result = await authService.changePassword(nueva_password, confirmar_password);
    if (result.success) {
      setUser(prev => ({ ...prev, primer_login: false }));
    }
    return result;
  }, []);

  const hasPermission = useCallback((modulo) => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.tipo_usuario]?.includes(modulo) || false;
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    changePassword,
    hasPermission,
  }), [user, loading, isAuthenticated, login, logout, changePassword, hasPermission]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
