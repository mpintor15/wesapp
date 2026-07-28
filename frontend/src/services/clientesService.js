import api from './api';
import { buildServiceFailure } from './serviceUtils';

const clientesService = {
  async listClientes(params = {}) {
    try {
      const response = await api.get('/clientes', { params });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener clientes');
    }
  },

  async getCliente(id) {
    try {
      const response = await api.get(`/clientes/${id}`);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener cliente');
    }
  },

  async createCliente(data) {
    try {
      const response = await api.post('/clientes', data);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al crear cliente');
    }
  },

  async updateCliente(id, data) {
    try {
      const response = await api.put(`/clientes/${id}`, data);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al actualizar cliente');
    }
  },

  async deleteCliente(id) {
    try {
      const response = await api.delete(`/clientes/${id}`);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al eliminar cliente');
    }
  },
};

export default clientesService;
