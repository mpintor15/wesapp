import api from './api';

const usuariosService = {
  getUsuarios: async (params = {}) => {
    try {
      const response = await api.get('/usuarios', { params });
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al obtener usuarios' };
    }
  },


  createUsuario: async (data) => {
    try {
      const response = await api.post('/usuarios', data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al crear usuario' };
    }
  },

  updateUsuario: async (id, data) => {
    try {
      const response = await api.put(`/usuarios/${id}`, data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al actualizar usuario' };
    }
  },

  deleteUsuario: async (id) => {
    try {
      const response = await api.delete(`/usuarios/${id}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al eliminar usuario' };
    }
  }
};

export default usuariosService;
