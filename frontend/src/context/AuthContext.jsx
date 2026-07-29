import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import authService from '../services/authService';
import { AUTH_EXPIRED_EVENT, AUTH_PERMISSIONS_CHANGED_EVENT } from '../services/api';
import { canAny } from '../auth/authorization';

const AuthContext = createContext(null);

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

const getInitialAuthState = () => {
  const token = localStorage.getItem('token');
  const storedUser = parseStoredUser();
  return {
    user: storedUser,
    isAuthenticated: Boolean(token),
    loading: Boolean(token && !storedUser),
  };
};

export const AuthProvider = ({ children }) => {
  const [initialAuthState] = useState(getInitialAuthState);
  const [user, setUser] = useState(initialAuthState.user);
  const [loading, setLoading] = useState(initialAuthState.loading);
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthState.isAuthenticated);
  const permissionResyncPromiseRef = useRef(null);

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

  const resyncAuthenticatedUser = useCallback(() => {
    if (permissionResyncPromiseRef.current) {
      return permissionResyncPromiseRef.current;
    }

    permissionResyncPromiseRef.current = authService
      .verifyToken()
      .then((result) => {
        if (result.success) {
          setUser(result.user);
          setIsAuthenticated(true);
          return result;
        }

        if (result.status === 401) {
          clearSession();
        }

        return result;
      })
      .catch((error) => {
        console.error('Error al resincronizar usuario:', error);
        return { success: false, error };
      })
      .finally(() => {
        permissionResyncPromiseRef.current = null;
      });

    return permissionResyncPromiseRef.current;
  }, [clearSession]);

  useEffect(() => {
    const handlePermissionsChanged = () => {
      if (!localStorage.getItem('token')) return;
      void resyncAuthenticatedUser();
    };

    globalThis.addEventListener(AUTH_PERMISSIONS_CHANGED_EVENT, handlePermissionsChanged);
    return () =>
      globalThis.removeEventListener(AUTH_PERMISSIONS_CHANGED_EVENT, handlePermissionsChanged);
  }, [resyncAuthenticatedUser]);

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
      setUser((prev) => ({ ...prev, primer_login: false }));
    }
    return result;
  }, []);

  const hasPermission = useCallback((permission) => canAny(user, permission), [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated,
      login,
      logout,
      changePassword,
      hasPermission,
    }),
    [user, loading, isAuthenticated, login, logout, changePassword, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
