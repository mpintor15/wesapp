import api from './api';

const personalService = {
  getColaboradores: async (params = {}) => {
    try {
      const response = await api.get('/personal/colaboradores', { params });
      return {
        success: response.data.success,
        data: response.data.data || []
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener colaboradores'
      };
    }
  },

  createColaborador: async (data) => {
    try {
      const response = await api.post('/personal/colaboradores', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear colaborador'
      };
    }
  },

  updateColaborador: async (id, data) => {
    try {
      const response = await api.put(`/personal/colaboradores/${id}`, data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar colaborador'
      };
    }
  },

  deleteColaborador: async (id) => {
    try {
      const response = await api.delete(`/personal/colaboradores/${id}`);
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar colaborador'
      };
    }
  },

  exportExcel: async (params = {}) => {
    try {
      const response = await api.get('/personal/colaboradores/excel', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'colaboradores.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      return { success: false, message: 'Error al exportar Excel' };
    }
  }
};

export default personalService;
