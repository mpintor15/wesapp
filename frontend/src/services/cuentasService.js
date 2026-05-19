/**
 * cuentasService.js — Servicio del módulo Cuentas por Cobrar
 *
 * Centraliza todas las llamadas HTTP al endpoint /api/cuentas.
 * Cada método retorna { success, data?, message? } para manejo uniforme de errores.
 *
 *  CLIENTES
 *  - getClientes()                      : GET  /cuentas/clientes
 *  - exportClientesExcel()              : GET  /cuentas/clientes/excel → descarga .xlsx
 *  - createCliente(nombre, id)          : POST /cuentas/clientes
 *  - deleteCliente(id)                  : DEL  /cuentas/clientes/:id
 *
 *  FACTURAS
 *  - createFactura(data)                : POST /cuentas/facturas
 *  - deleteFactura(num)                 : DEL  /cuentas/facturas/:num
 *  - cancelFactura(num)                 : PATCH /cuentas/facturas/:num/cancelar
 *
 *  PAGOS / ABONOS
 *  - getPagos()                         : GET  /cuentas/pagos
 *  - exportPagosExcel()                 : GET  /cuentas/pagos/excel → descarga .xlsx
 *  - deletePago(id)                     : DEL  /cuentas/pagos/:id
 *  - getAbonosByFactura(num)            : GET  /cuentas/abonos/:num
 *  - createBatchAbono(data)             : POST /cuentas/abonos/batch
 *                                         Crea un pago con detalle (pagos) y
 *                                         distribuye los abonos por factura.
 *
 *  REPORTE
 *  - getReporte(params)                 : GET  /cuentas/reporte (con filtros)
 *  - exportExcel(params)                : GET  /cuentas/reporte/excel → descarga .xlsx
 */
import api from './api';
import {
  extractError,
  getFilenameFromDisposition,
  saveBlobWithPickerOrDownload,
} from './serviceUtils';

const cuentasService = {
  // ============================================
  // CLIENTES
  // ============================================

  getClientes: async () => {
    try {
      const response = await api.get('/cuentas/clientes');
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al obtener clientes') };
    }
  },

  exportClientesExcel: async () => {
    try {
      const response = await api.get('/cuentas/clientes/excel', { responseType: 'blob' });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'reporte_clientes.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      });
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al exportar clientes') };
    }
  },

  createCliente: async (nombre, identificacion) => {
    try {
      const response = await api.post('/cuentas/clientes', { nombre, identificacion });
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al crear cliente') };
    }
  },

  deleteCliente: async (id) => {
    try {
      const response = await api.delete(`/cuentas/clientes/${id}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al eliminar cliente') };
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
      return { success: false, message: extractError(error, 'Error al crear factura') };
    }
  },

  deleteFactura: async (num_factura) => {
    try {
      const response = await api.delete(`/cuentas/facturas/${num_factura}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al eliminar factura') };
    }
  },

  cancelFactura: async (num_factura, data) => {
    try {
      const response = await api.patch(`/cuentas/facturas/${num_factura}/cancelar`, data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al cancelar factura') };
    }
  },

  getNextNumFactura: async () => {
    try {
      const response = await api.get('/cuentas/facturas/next-number');
      return { success: response.data.success, data: response.data.data };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al obtener siguiente número') };
    }
  },

  updateFactura: async (num_factura, data) => {
    try {
      const response = await api.patch(`/cuentas/facturas/${num_factura}`, data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al actualizar factura') };
    }
  },

  deleteAbono: async (id) => {
    try {
      const response = await api.delete(`/cuentas/abonos/${id}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al eliminar abono') };
    }
  },

  // ============================================
  // ABONOS
  // ============================================

  getPagos: async () => {
    try {
      const response = await api.get('/cuentas/pagos');
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al obtener pagos') };
    }
  },

  exportPagosExcel: async (params = {}) => {
    try {
      const response = await api.get('/cuentas/pagos/excel', { responseType: 'blob', params });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'reporte_pagos.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      });
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al exportar pagos') };
    }
  },

  deletePago: async (id) => {
    try {
      const response = await api.delete(`/cuentas/pagos/${id}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al eliminar pago') };
    }
  },

  getAbonosByFactura: async (num_factura) => {
    try {
      const response = await api.get(`/cuentas/abonos/${num_factura}`);
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al obtener abonos') };
    }
  },

  createBatchAbono: async (data) => {
    try {
      const response = await api.post('/cuentas/abonos/batch', data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al registrar pagos') };
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
      return { success: false, message: extractError(error, 'Error al obtener reporte') };
    }
  },

  exportExcel: async (params = {}) => {
    try {
      const response = await api.get('/cuentas/reporte/excel', { params, responseType: 'blob' });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        'reporte_cuentas.xlsx'
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      });
    } catch (error) {
      return { success: false, message: extractError(error, 'Error al exportar Excel') };
    }
  }
};

export default cuentasService;
