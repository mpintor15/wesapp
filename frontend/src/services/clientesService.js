import api from './api';

const clientesService = {
  // Obtener todos los clientes
  getClientes: async () => {
    try {
      const response = await api.get('/cuentas/clientes');
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      console.error('Error al obtener clientes:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener clientes'
      };
    }
  },

  // Crear un cliente
  createCliente: async (nombre, identificacion) => {
    try {
      const response = await api.post('/cuentas/clientes', { nombre, identificacion });
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error al crear cliente:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear cliente'
      };
    }
  },

  // Eliminar un cliente
  deleteCliente: async (id) => {
    try {
      const response = await api.delete(`/cuentas/clientes/${id}`);
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar cliente'
      };
    }
  }
};

export default clientesService;
