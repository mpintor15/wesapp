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
 *  - createMovimiento(data)             : POST /inventario/movimientos
 *  - downloadMovimientoPdf(id)          : GET /inventario/movimientos/:id/pdf → descarga .pdf
 *  - exportMovimientosExcel(params)     : GET /inventario/movimientos/excel → descarga .xlsx
 */
import api from './api';
import {
  extractError,
  getFilenameFromDisposition,
  saveBlobWithPickerOrDownload
} from './serviceUtils';

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
        message: extractError(error, 'Error al obtener ubicaciones')
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
        message: extractError(error, 'Error al obtener articulos')
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
        message: extractError(error, 'Error al crear artículo')
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
        message: extractError(error, 'Error al actualizar artículo')
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
        message: extractError(error, 'Error al eliminar artículo')
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
        message: extractError(error, 'Error al obtener movimientos')
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
        message: extractError(error, 'Error al crear movimiento')
      };
    }
  },

  downloadMovimientoPdf: async (id) => {
    try {
      const response = await api.get(`/inventario/movimientos/${id}/pdf`, {
        responseType: 'blob'
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        `movimiento-${id}.pdf`
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'PDF',
        accept: { 'application/pdf': ['.pdf'] }
      });
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al descargar PDF')
      };
    }
  },

  exportArticulosExcel: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos/excel', {
        params,
        responseType: 'blob'
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'inventario.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      });
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al exportar Excel')
      };
    }
  },

  exportMovimientosExcel: async (params = {}) => {
    try {
      const response = await api.get('/inventario/movimientos/excel', {
        params,
        responseType: 'blob'
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'movimientos-inventario.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      });
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al exportar movimientos')
      };
    }
  }
};

export default inventarioService;
