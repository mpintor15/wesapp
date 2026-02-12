import api from './api';

const cuentasService = {
  // ============================================
  // CLIENTES
  // ============================================

  getClientes: async () => {
    try {
      const response = await api.get('/cuentas/clientes');
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener clientes'
      };
    }
  },

  createCliente: async (nombre, identificacion) => {
    try {
      const response = await api.post('/cuentas/clientes', { nombre, identificacion });
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear cliente'
      };
    }
  },

  deleteCliente: async (id) => {
    try {
      const response = await api.delete(`/cuentas/clientes/${id}`);
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar cliente'
      };
    }
  },

  // ============================================
  // FACTURAS
  // ============================================

  getFacturas: async () => {
    try {
      const response = await api.get('/cuentas/facturas');
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener facturas'
      };
    }
  },

  createFactura: async (data) => {
    try {
      const response = await api.post('/cuentas/facturas', data);
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear factura'
      };
    }
  },

  deleteFactura: async (num_factura) => {
    try {
      const response = await api.delete(`/cuentas/facturas/${num_factura}`);
      if (response.data.success) {
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar factura'
      };
    }
  },

  cancelFactura: async (num_factura) => {
    try {
      const response = await api.patch(`/cuentas/facturas/${num_factura}/cancelar`);
      if (response.data.success) {
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cancelar factura'
      };
    }
  },

  // ============================================
  // RETENCIONES
  // ============================================

  getRetencionesByFactura: async (num_factura) => {
    try {
      const response = await api.get(`/cuentas/retenciones/${num_factura}`);
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener retenciones'
      };
    }
  },

  createRetencion: async (data) => {
    try {
      const response = await api.post('/cuentas/retenciones', data);
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear retención'
      };
    }
  },

  // ============================================
  // ABONOS
  // ============================================

  getAbonosByFactura: async (num_factura) => {
    try {
      const response = await api.get(`/cuentas/abonos/${num_factura}`);
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener abonos'
      };
    }
  },

  createAbono: async (data) => {
    try {
      const response = await api.post('/cuentas/abonos', data);
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear abono'
      };
    }
  },

  // ============================================
  // REPORTE
  // ============================================

  getReporte: async (params = {}) => {
    try {
      const response = await api.get('/cuentas/reporte', { params });
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener reporte'
      };
    }
  },

  exportExcel: async (params = {}) => {
    try {
      const response = await api.get('/cuentas/reporte/excel', {
        params,
        responseType: 'blob'
      });

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
      return {
        success: false,
        message: 'Error al exportar Excel'
      };
    }
  }
};

export default cuentasService;
