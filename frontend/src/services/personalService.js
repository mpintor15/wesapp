/**
 * personalService.js — Servicio del módulo Personal
 *
 * Centraliza todas las llamadas HTTP al endpoint /api/personal.
 * Cada método retorna { success, data?, message? }.
 *
 *  - getColaboradores(params)    : GET  /personal/colaboradores
 *                                  Filtros: search, estado, cargo.
 *  - createColaborador(data)     : POST /personal/colaboradores
 *  - updateColaborador(id, data) : PUT  /personal/colaboradores/:id
 *  - deleteColaborador(id)       : DEL  /personal/colaboradores/:id
 *  - exportExcel(params)         : GET  /personal/colaboradores/excel → descarga .xlsx
 */
import api from './api';
import {
  extractError,
  getFilenameFromDisposition,
  saveBlobWithPickerOrDownload,
} from './serviceUtils';

const personalService = {
  getColaboradores: async (params = {}) => {
    try {
      const response = await api.get('/personal/colaboradores', { params });
      return {
        success: response.data.success,
        data: response.data.data || [],
      };
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al obtener colaboradores'),
      };
    }
  },

  createColaborador: async (data) => {
    try {
      const response = await api.post('/personal/colaboradores', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al crear colaborador'),
      };
    }
  },

  updateColaborador: async (id, data) => {
    try {
      const response = await api.put(`/personal/colaboradores/${id}`, data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al actualizar colaborador'),
      };
    }
  },

  deleteColaborador: async (id) => {
    try {
      const response = await api.delete(`/personal/colaboradores/${id}`);
      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: extractError(error, 'Error al eliminar colaborador'),
      };
    }
  },

  exportExcel: async (params = {}) => {
    try {
      const response = await api.get('/personal/colaboradores/excel', {
        params,
        responseType: 'blob',
      });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'colaboradores.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      });
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al exportar Excel') };
    }
  },
};

export default personalService;
