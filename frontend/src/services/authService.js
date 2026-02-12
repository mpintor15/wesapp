import api from './api';

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
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión'
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
        const user = JSON.parse(localStorage.getItem('user'));
        user.primer_login = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cambiar contraseña'
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
  },

  /**
   * Obtener usuario actual
   */
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  }
};

export default authService;