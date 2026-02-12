import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar autenticación al cargar
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        const result = await authService.verifyToken();
        if (result.success) {
          setUser(result.user);
          setIsAuthenticated(true);
        } else {
          // Token inválido, limpiar
          authService.logout();
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (usuario, password) => {
    const result = await authService.login(usuario, password);
    
    if (result.success) {
      setUser(result.data.user);
      setIsAuthenticated(true);
    }
    
    return result;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const changePassword = async (nueva_password, confirmar_password) => {
    const result = await authService.changePassword(nueva_password, confirmar_password);
    
    if (result.success) {
      // Actualizar el usuario en el estado
      const updatedUser = { ...user, primer_login: false };
      setUser(updatedUser);
    }
    
    return result;
  };

  const hasPermission = (modulo) => {
    if (!user) return false;
    
    const permissions = {
      gerente: ['cuentas', 'inventario', 'personal', 'usuarios', 'crear_articulo', 'eliminar_articulo', 'crear_movimiento', 'exportar'],
      secretario: ['cuentas', 'inventario', 'personal', 'crear_articulo', 'eliminar_articulo', 'crear_movimiento', 'exportar'],
      supervisor: ['inventario', 'personal', 'crear_movimiento', 'exportar'],
      contador: ['cuentas']
    };
    
    return permissions[user.tipo_usuario]?.includes(modulo) || false;
  };

  const isUserType = (tipos) => {
    if (!user) return false;
    return Array.isArray(tipos) 
      ? tipos.includes(user.tipo_usuario)
      : user.tipo_usuario === tipos;
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    changePassword,
    hasPermission,
    isUserType
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  
  return context;
};

export default AuthContext;