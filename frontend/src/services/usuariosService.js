/**
 * usuariosService.js — Servicio del módulo Usuarios del sistema
 *
 * Centraliza las llamadas HTTP al endpoint /api/usuarios.
 * Solo accesible por usuarios con rol 'gerente'.
 * Cada método retorna { success, data?, message? }.
 *
 *  - getUsuarios(params)        : GET  /usuarios
 *                                 Filtros: search, tipo_usuario, activo.
 *  - createUsuario(data)        : POST /usuarios
 *                                 Crea usuario con rol y contraseña inicial.
 *  - updateUsuario(id, data)    : PUT  /usuarios/:id
 *                                 Permite cambiar tipo_usuario y/o estado activo.
 *  - reenviarInvitacion(id)     : POST /usuarios/:id/invitacion
 *                                 Regenera contraseña temporal para usuarios pendientes.
 *  - deleteUsuario(id)          : DEL  /usuarios/:id
 */
import api from './api';
import { buildServiceFailure } from './serviceUtils';

const usuariosService = {
  getUsuarios: async (params = {}) => {
    try {
      const response = await api.get('/usuarios', { params });
      return { success: response.data.success, data: response.data.data || [] };
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener usuarios');
    }
  },

  createUsuario: async (data) => {
    try {
      const response = await api.post('/usuarios', data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return buildServiceFailure(error, 'Error al crear usuario');
    }
  },

  updateUsuario: async (id, data) => {
    try {
      const response = await api.put(`/usuarios/${id}`, data);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return buildServiceFailure(error, 'Error al actualizar usuario');
    }
  },

  reenviarInvitacion: async (id) => {
    try {
      const response = await api.post(`/usuarios/${id}/invitacion`);
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      return buildServiceFailure(error, 'Error al reenviar invitación');
    }
  },

  deleteUsuario: async (id) => {
    try {
      const response = await api.delete(`/usuarios/${id}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return buildServiceFailure(error, 'Error al eliminar usuario');
    }
  },
};

export default usuariosService;
