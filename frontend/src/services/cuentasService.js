/**
 * cuentasService.js — Servicio del módulo Cuentas por Cobrar
 *
 * Centraliza todas las llamadas HTTP al endpoint /api/cuentas.
 * Cada método retorna { success, data?, message? } para manejo uniforme de errores.
 *
 *  CLIENTES
 *  - getClientes()                      : GET  /cuentas/clientes
 *  - createCliente(nombre, id)          : POST /cuentas/clientes
 *  - deleteCliente(id)                  : DEL  /cuentas/clientes/:id
 *
 *  FACTURAS
 *  - createFactura(data)                : POST /cuentas/facturas
 *  - deleteFactura(num)                 : DEL  /cuentas/facturas/:num
 *  - cancelFactura(num)                 : PATCH /cuentas/facturas/:num/cancelar
 *
 *  ABONOS
 *  - getAbonosByFactura(num)            : GET  /cuentas/abonos/:num
 *  - createAbono(data)                  : POST /cuentas/abonos
 *  - createBatchAbono(data)             : POST /cuentas/abonos/batch
 *                                         Registra múltiples abonos en una
 *                                         transacción atómica por cliente.
 *
 *  REPORTE
 *  - getReporte(params)                 : GET  /cuentas/reporte (con filtros)
 *  - exportExcel(params)                : GET  /cuentas/reporte/excel → descarga .xlsx
 */
import api from './api';

const cuentasService = {
  // ============================================
  // CLIENTES
  // ============================================

  getClientes: async () => {
    try {
      const response = await api.get('/cuentas/clientes');
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al obtener clientes' };
    }
  },

  createCliente: async (nombre, identificacion) => {
    try {
      const response = await api.post('/cuentas/clientes', { nombre, identificacion });
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al crear cliente' };
    }
  },

  deleteCliente: async (id) => {
    try {
      const response = await api.delete(`/cuentas/clientes/${id}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al eliminar cliente' };
    }
  },

  // ============================================
  // FACTURAS
  // ============================================

  createFactura: async (data) => {
    try {
      const response = await api.post('/cuentas/facturas', data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al crear factura' };
    }
  },

  deleteFactura: async (num_factura) => {
    try {
      const response = await api.delete(`/cuentas/facturas/${num_factura}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al eliminar factura' };
    }
  },

  cancelFactura: async (num_factura) => {
    try {
      const response = await api.patch(`/cuentas/facturas/${num_factura}/cancelar`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al cancelar factura' };
    }
  },

  // ============================================
  // ABONOS
  // ============================================

  getAbonosByFactura: async (num_factura) => {
    try {
      const response = await api.get(`/cuentas/abonos/${num_factura}`);
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al obtener abonos' };
    }
  },

  createAbono: async (data) => {
    try {
      const response = await api.post('/cuentas/abonos', data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al crear abono' };
    }
  },

  createBatchAbono: async (data) => {
    try {
      const response = await api.post('/cuentas/abonos/batch', data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al registrar pagos' };
    }
  },

  // ============================================
  // REPORTE
  // ============================================

  getReporte: async (params = {}) => {
    try {
      const response = await api.get('/cuentas/reporte', { params });
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al obtener reporte' };
    }
  },

  exportExcel: async (params = {}) => {
    try {
      const response = await api.get('/cuentas/reporte/excel', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reporte_cuentas.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Error al exportar Excel' };
    }
  }
};

export default cuentasService;
