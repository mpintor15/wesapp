/**
 * inventarioService.js — Servicio del módulo Inventario
 *
 * Centraliza todas las llamadas HTTP al endpoint /api/inventario.
 * Cada método retorna { success, data?, message? }.
 *
 *  UBICACIONES
 *  - getUbicaciones()                   : GET /inventario/ubicaciones
 *  - getUbicacionesAgrupadas()          : GET /inventario/ubicaciones/agrupadas
 *  - createUbicacion(data)              : POST /inventario/ubicaciones
 *  - updateUbicacion(id, data)          : PUT  /inventario/ubicaciones/:id
 *  - deleteUbicacion(id)                : DEL  /inventario/ubicaciones/:id
 *
 *  ARTÍCULOS
 *  - getArticulos(params)               : GET /inventario/articulos (filtros: tipo, ubicacion_id, estado, search)
 *  - getBajasArticulos(params)          : GET /inventario/articulos/bajas (filtros: search, from, to)
 *  - createArticulo(data)               : POST /inventario/articulos
 *  - updateArticulo(id, data)           : PUT  /inventario/articulos/:id
 *  - darBajaArticulo(id, data)          : POST /inventario/articulos/:id/baja
 *  - deleteArticulo(id, motivo)         : DEL  /inventario/articulos/:id
 *  - exportArticulosExcel(params)       : GET  /inventario/articulos/excel → descarga .xlsx
 *  - exportBajasArticulosExcel(params)  : GET  /inventario/articulos/bajas/excel → descarga .xlsx
 *
 *  MOVIMIENTOS (traslados)
 *  - getMovimientos()                   : GET /inventario/movimientos
 *  - createMovimiento(data)             : POST /inventario/movimientos
 *  - downloadMovimientoPdf(id)          : GET /inventario/movimientos/:id/pdf → descarga .pdf
 *  - regenerateMovimientoPdf(id)        : POST /inventario/movimientos/:id/pdf/regenerar
 *  - exportMovimientosExcel(params)     : GET /inventario/movimientos/excel → descarga .xlsx
 */
import api from './api';
import {
  extractError,
  getFilenameFromDisposition,
  normalizeServiceError,
  saveBlobWithPickerOrDownload,
} from './serviceUtils';
import { normalizePagination } from '../utils/pagination';

export const INVENTARIO_ERROR_MESSAGES = {
  INSUFFICIENT_STOCK: 'No existe stock suficiente para completar la operación.',
  CANNOT_VOID_INSUFFICIENT_STOCK: 'No se puede anular porque la reversión dejaría stock negativo.',
  MOVEMENT_ALREADY_VOIDED: 'El movimiento ya fue anulado.',
  MOVEMENT_ADMINISTRATIVELY_DELETED: 'El movimiento fue eliminado administrativamente.',
  MOVEMENT_REVERSAL_DATA_INCOMPLETE:
    'Este movimiento histórico no contiene información suficiente para una reversión automática.',
  MOVEMENT_MUST_BE_VOIDED_FIRST:
    'Debe anular el movimiento antes de eliminarlo administrativamente.',
  BAJA_ALREADY_VOIDED: 'La baja ya fue anulada.',
  BAJA_ADMINISTRATIVELY_DELETED: 'La baja fue eliminada administrativamente.',
  BAJA_REVERSAL_DATA_INCOMPLETE:
    'Esta baja no contiene información suficiente para una reversión automática.',
  BAJA_MUST_BE_VOIDED_FIRST: 'Debe anular la baja antes de eliminarla administrativamente.',
  PARTIAL_ARTICLE_DELETE_DEPRECATED:
    'La reducción parcial mediante eliminación ya no está disponible. Use una baja o un movimiento.',
  MOVEMENT_PDF_NOT_AVAILABLE: 'El PDF del movimiento no está disponible.',
  PDF_GENERATION_FAILED: 'El PDF no pudo generarse.',
};

const getInventoryErrorCode = (error) => error?.response?.data?.code;

export const extractInventoryError = (error, fallback) => {
  const code = getInventoryErrorCode(error);
  const message = code ? INVENTARIO_ERROR_MESSAGES[code] : '';
  const normalized = normalizeServiceError(error, fallback);
  const backendMessage = error?.response?.data?.message;
  return {
    ...normalized,
    code,
    message: message || backendMessage || extractError(error, fallback),
  };
};

const parseBlobError = async (error, fallback) => {
  const data = error?.response?.data;
  if (!(data instanceof Blob)) {
    return extractInventoryError(error, fallback);
  }

  try {
    const text = await data.text();
    const parsed = JSON.parse(text);
    const code = parsed?.code;
    return {
      code,
      message: (code && INVENTARIO_ERROR_MESSAGES[code]) || parsed?.message || fallback,
      status: error?.response?.status,
    };
  } catch {
    return { code: undefined, message: fallback, status: error?.response?.status };
  }
};

const failure = (error, fallback) => ({
  success: false,
  ...extractInventoryError(error, fallback),
});

const inventarioService = {
  getUbicaciones: async (params = {}) => {
    try {
      const response = await api.get('/inventario/ubicaciones', { params });
      return {
        success: response.data.success,
        data: response.data.data || [],
      };
    } catch (error) {
      return failure(error, 'Error al obtener ubicaciones');
    }
  },

  getUbicacionesAgrupadas: async (params = {}) => {
    try {
      const response = await api.get('/inventario/ubicaciones/agrupadas', { params });
      return {
        success: response.data.success,
        data: response.data.data || [],
        meta: response.data.meta || {
          page: 1,
          pageSize: 25,
          totalGroups: 0,
          filteredGroups: 0,
          totalLocations: 0,
          filteredLocations: 0,
          totalPages: 0,
        },
      };
    } catch (error) {
      return failure(error, 'Error al obtener ubicaciones agrupadas');
    }
  },

  createUbicacion: async (data) => {
    try {
      const response = await api.post('/inventario/ubicaciones', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al crear ubicación');
    }
  },

  updateUbicacion: async (id, data) => {
    try {
      const response = await api.put(`/inventario/ubicaciones/${id}`, data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al actualizar ubicación');
    }
  },

  deleteUbicacion: async (id) => {
    try {
      const response = await api.delete(`/inventario/ubicaciones/${id}`);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al eliminar ubicación');
    }
  },

  getManzanas: async (ubicacionId) => {
    try {
      const response = await api.get(`/inventario/ubicaciones/${ubicacionId}/manzanas`);
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return failure(error, 'Error al obtener Manzanas');
    }
  },

  createManzana: async (ubicacionId, data) => {
    try {
      const response = await api.post(`/inventario/ubicaciones/${ubicacionId}/manzanas`, data);
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return failure(error, 'Error al crear Manzana');
    }
  },

  updateManzana: async (manzanaId, data) => {
    try {
      const response = await api.put(`/inventario/ubicaciones/manzanas/${manzanaId}`, data);
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return failure(error, 'Error al actualizar Manzana');
    }
  },

  getVillas: async (manzanaId) => {
    try {
      const response = await api.get(`/inventario/ubicaciones/manzanas/${manzanaId}/villas`);
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return failure(error, 'Error al obtener Villas');
    }
  },

  createVilla: async (manzanaId, data) => {
    try {
      const response = await api.post(`/inventario/ubicaciones/manzanas/${manzanaId}/villas`, data);
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return failure(error, 'Error al crear Villa');
    }
  },

  updateVilla: async (villaId, data) => {
    try {
      const response = await api.put(`/inventario/ubicaciones/villas/${villaId}`, data);
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return failure(error, 'Error al actualizar Villa');
    }
  },

  getResidentePrincipal: async (villaId) => {
    try {
      const response = await api.get(
        `/inventario/ubicaciones/villas/${villaId}/residente-principal`
      );
      return { success: response.data.success, data: response.data.data || null };
    } catch (error) {
      return failure(error, 'Error al obtener Residente principal');
    }
  },

  createResidentePrincipal: async (villaId, data) => {
    try {
      const response = await api.post(
        `/inventario/ubicaciones/villas/${villaId}/residente-principal`,
        data
      );
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return failure(error, 'Error al crear Residente principal');
    }
  },

  updateResidentePrincipal: async (residenteId, data) => {
    try {
      const response = await api.put(`/inventario/ubicaciones/residentes/${residenteId}`, data);
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return failure(error, 'Error al actualizar Residente principal');
    }
  },

  getArticulos: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos', { params });
      const data = response.data.data || [];
      return {
        success: response.data.success,
        data,
        pagination: normalizePagination(response.data.pagination, data.length),
      };
    } catch (error) {
      return failure(error, 'Error al obtener articulos');
    }
  },

  getArticulosCatalogo: async () => {
    try {
      const response = await api.get('/inventario/articulos/catalogo');
      return {
        success: response.data.success,
        data: response.data.data || [],
      };
    } catch (error) {
      return failure(error, 'Error al obtener catálogo de artículos');
    }
  },

  createArticulo: async (data) => {
    try {
      const response = await api.post('/inventario/articulos', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al crear artículo');
    }
  },

  getBajasArticulos: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos/bajas', { params });
      return {
        success: response.data.success,
        data: response.data.data || [],
      };
    } catch (error) {
      return failure(error, 'Error al obtener artículos dados de baja');
    }
  },

  darBajaArticulo: async (id, data) => {
    try {
      const response = await api.post(`/inventario/articulos/${id}/baja`, data);
      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error) {
      return failure(error, 'Error al dar de baja artículo');
    }
  },

  updateArticulo: async (id, data) => {
    try {
      const response = await api.put(`/inventario/articulos/${id}`, data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al actualizar artículo');
    }
  },

  deleteArticulo: async (id, motivo) => {
    try {
      const response = await api.delete(`/inventario/articulos/${id}`, {
        data: { motivo },
      });
      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error) {
      return failure(error, 'Error al eliminar artículo');
    }
  },

  getMovimientos: async (params = {}) => {
    try {
      const response = await api.get('/inventario/movimientos', { params });
      const data = response.data.data || [];
      return {
        success: response.data.success,
        data,
        pagination: normalizePagination(response.data.pagination, data.length),
      };
    } catch (error) {
      return failure(error, 'Error al obtener movimientos');
    }
  },

  createMovimiento: async (data) => {
    try {
      const response = await api.post('/inventario/movimientos', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
        movement: response.data.movement,
        pdf: response.data.pdf,
      };
    } catch (error) {
      return failure(error, 'Error al crear movimiento');
    }
  },

  anularMovimiento: async (id, motivo) => {
    try {
      const response = await api.post(`/inventario/movimientos/${id}/anular`, { motivo });
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al anular movimiento');
    }
  },

  eliminarMovimiento: async (id, motivo) => {
    try {
      const response = await api.delete(`/inventario/movimientos/${id}`, { data: { motivo } });
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al eliminar movimiento');
    }
  },

  anularBaja: async (id, motivo) => {
    try {
      const response = await api.post(`/inventario/bajas/${id}/anular`, { motivo });
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al anular baja');
    }
  },

  eliminarBaja: async (id, motivo) => {
    try {
      const response = await api.delete(`/inventario/bajas/${id}`, { data: { motivo } });
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al eliminar baja');
    }
  },

  downloadMovimientoPdf: async (id) => {
    try {
      const response = await api.get(`/inventario/movimientos/${id}/pdf`, {
        responseType: 'blob',
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        `movimiento-${id}.pdf`
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'PDF',
        accept: { 'application/pdf': ['.pdf'] },
      });
    } catch (error) {
      const parsed = await parseBlobError(error, 'Error al descargar PDF');
      return {
        success: false,
        ...parsed,
      };
    }
  },

  regenerateMovimientoPdf: async (id) => {
    try {
      const response = await api.post(`/inventario/movimientos/${id}/pdf/regenerar`);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return failure(error, 'Error al regenerar PDF');
    }
  },

  exportArticulosExcel: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos/excel', {
        params,
        responseType: 'blob',
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'inventario.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      });
    } catch (error) {
      return failure(error, 'Error al exportar Excel');
    }
  },

  exportBajasArticulosExcel: async (params = {}) => {
    try {
      const response = await api.get('/inventario/articulos/bajas/excel', {
        params,
        responseType: 'blob',
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'articulos-dados-de-baja.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      });
    } catch (error) {
      return failure(error, 'Error al exportar bajas');
    }
  },

  exportMovimientosExcel: async (params = {}) => {
    try {
      const response = await api.get('/inventario/movimientos/excel', {
        params,
        responseType: 'blob',
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'movimientos-inventario.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      });
    } catch (error) {
      return failure(error, 'Error al exportar movimientos');
    }
  },
};

inventarioService.eliminarArticulo = inventarioService.deleteArticulo;
inventarioService.descargarMovimientoPdf = inventarioService.downloadMovimientoPdf;
inventarioService.regenerarMovimientoPdf = inventarioService.regenerateMovimientoPdf;

export default inventarioService;
