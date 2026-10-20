import api from './api';
import { buildServiceFailure } from './serviceUtils';
import { normalizePagination } from '../utils/pagination';

const clientesService = {
  async listClientes(params = {}) {
    try {
      const response = await api.get('/clientes', { params });
      const data = response.data.data || [];
      return {
        ...response.data,
        pagination: normalizePagination(response.data.pagination, data.length),
      };
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener clientes');
    }
  },

  async listOpcionesUbicaciones() {
    try {
      const response = await api.get('/clientes/opciones-ubicaciones');
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener clientes para ubicaciones');
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

  async getAccesoPortal(id) {
    try {
      const response = await api.get(`/clientes/${id}/acceso-portal`);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener el acceso del cliente');
    }
  },

  async createAccesoPortal(id, usuario) {
    try {
      const response = await api.post(`/clientes/${id}/acceso-portal`, { usuario });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al crear el acceso del cliente');
    }
  },

  async setAccesoPortalActivo(id, activo) {
    try {
      const response = await api.patch(`/clientes/${id}/acceso-portal`, { activo });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al actualizar el acceso del cliente');
    }
  },

  async resetAccesoPortal(id) {
    try {
      const response = await api.post(`/clientes/${id}/acceso-portal/restablecer`, {});
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al restablecer la contraseña del cliente');
    }
  },

  async deleteAccesoPortal(id) {
    try {
      const response = await api.delete(`/clientes/${id}/acceso-portal`);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al eliminar el acceso del cliente');
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
