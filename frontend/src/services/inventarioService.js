/**
 * inventarioService.js — Servicio del módulo Inventario
 *
 * Centraliza todas las llamadas HTTP al endpoint /api/inventario.
 * Cada método retorna { success, data?, message? }.
 *
 *  UBICACIONES
 *  - getUbicaciones()                   : GET /inventario/ubicaciones
 *
 *  ARTÍCULOS
 *  - getArticulos(params)               : GET /inventario/articulos (filtros: tipo, ubicacion_id, estado, search)
 *  - createArticulo(data)               : POST /inventario/articulos
 *  - updateArticulo(id, data)           : PUT  /inventario/articulos/:id
 *  - deleteArticulo(id, cantidad?)      : DEL  /inventario/articulos/:id
 *                                         Para equipos con stock > 1 recibe la
 *                                         cantidad a eliminar como query param.
 *  - exportArticulosExcel(params)       : GET  /inventario/articulos/excel → descarga .xlsx
 *
 *  MOVIMIENTOS (traslados)
 *  - getMovimientos()                   : GET /inventario/movimientos
 *  - getMovimientoDetalles(id)          : GET /inventario/movimientos/:id
 *  - createMovimiento(data)             : POST /inventario/movimientos
 *  - downloadMovimientoPdf(id)          : GET /inventario/movimientos/:id/pdf → descarga .pdf
 */
import api from './api';

const inventarioService = {
  getUbicaciones: async () => {
    try {
      const response = await api.get('/inventario/ubicaciones');
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener ubicaciones'
      };
    }
  },

  getArticulos: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos', { params });
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener articulos'
      };
    }
  },

  createArticulo: async (data) => {
    try {
      const response = await api.post('/inventario/articulos', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear artículo'
      };
    }
  },

  updateArticulo: async (id, data) => {
    try {
      const response = await api.put(`/inventario/articulos/${id}`, data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar artículo'
      };
    }
  },

  deleteArticulo: async (id, cantidad = null) => {
    try {
      const response = await api.delete(`/inventario/articulos/${id}`, {
        params: cantidad ? { cantidad } : {}
      });
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar artículo'
      };
    }
  },

  getMovimientos: async () => {
    try {
      const response = await api.get('/inventario/movimientos');
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener movimientos'
      };
    }
  },

  getMovimientoDetalles: async (id) => {
    try {
      const response = await api.get(`/inventario/movimientos/${id}`);
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener detalles'
      };
    }
  },

  createMovimiento: async (data) => {
    try {
      const response = await api.post('/inventario/movimientos', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear movimiento'
      };
    }
  },

  downloadMovimientoPdf: async (id) => {
    try {
      const response = await api.get(`/inventario/movimientos/${id}/pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `movimiento-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: 'Error al descargar PDF'
      };
    }
  },

  exportArticulosExcel: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos/excel', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventario.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al exportar Excel'
      };
    }
  }
};

export default inventarioService;
