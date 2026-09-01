import api from './api';
import {
  buildServiceFailure,
  getFilenameFromDisposition,
  saveBlobWithPickerOrDownload,
} from './serviceUtils';

const HISTORY_PARAM_KEYS = [
  'page',
  'pageSize',
  'ubicacion_id',
  'fecha_desde',
  'fecha_hasta',
  'estado',
  'autor',
];
const VISIT_PARAM_KEYS = [
  'page',
  'pageSize',
  'estado',
  'creator',
  'fecha_desde',
  'fecha_hasta',
  'search',
];
const VISIT_FORM_PARAM_KEYS = ['page', 'pageSize', 'nombre', 'ubicacion_id', 'creator', 'estado'];

const pickDefined = (source, keys) =>
  keys.reduce((result, key) => {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') result[key] = value;
    return result;
  }, {});

const bitacorasService = {
  async exportExcel(path, params, fallbackName) {
    try {
      const response = await api.get(path, { params, responseType: 'blob' });
      const fileName = getFilenameFromDisposition(
        response.headers?.['content-disposition'],
        fallbackName
      );
      return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
        description: 'Excel',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      });
    } catch (error) {
      return buildServiceFailure(error, 'Error al exportar reporte');
    }
  },

  async getUbicaciones() {
    try {
      const response = await api.get('/bitacoras/ubicaciones');
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener Ubicaciones de Bitácora');
    }
  },

  async getManzanas(ubicacionId) {
    try {
      const response = await api.get(`/bitacoras/ubicaciones/${ubicacionId}/manzanas`);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener Manzanas de Bitácora');
    }
  },

  async getVillas(manzanaId) {
    try {
      const response = await api.get(`/bitacoras/manzanas/${manzanaId}/villas`);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener Villas de Bitácora');
    }
  },

  async getFormularioVisitasActivo(ubicacionId) {
    try {
      const response = await api.get(
        `/bitacoras/ubicaciones/${ubicacionId}/formulario-visitas/activo`
      );
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener formulario de visitas');
    }
  },

  async getFormulariosVisitas(params = {}) {
    try {
      const response = await api.get('/bitacoras/formularios-visitas', {
        params: pickDefined(params, VISIT_FORM_PARAM_KEYS),
      });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener formularios de visitas');
    }
  },

  async exportFormulariosVisitas(params = {}) {
    return this.exportExcel(
      '/bitacoras/formularios-visitas/excel',
      pickDefined(params, VISIT_FORM_PARAM_KEYS),
      'reporte_formularios_visitas.xlsx'
    );
  },

  async publishFormularioVisitas(ubicacionId, data = {}) {
    const payload = pickDefined(data, ['titulo', 'mostrar_fecha_hora', 'tipos_visita', 'fields']);
    try {
      const response = await api.post(
        `/bitacoras/ubicaciones/${ubicacionId}/formulario-visitas/publicar`,
        payload
      );
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al publicar formulario de visitas');
    }
  },

  async archiveFormularioVisitas(formId) {
    try {
      const response = await api.post(`/bitacoras/formularios-visitas/${formId}/archivar`, {});
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al cambiar el estado del formulario');
    }
  },

  async createVisita(data = {}) {
    const payload = pickDefined(data, [
      'ubicacion_id',
      'manzana_id',
      'villa_id',
      'visitante_nombre',
      'visitante_documento',
      'visitante_telefono',
      'tipo_visita_id',
      'placa',
      'respuestas',
    ]);
    try {
      const response = await api.post('/bitacoras/visitas', payload);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al registrar visita');
    }
  },

  async getVisitas(params = {}) {
    try {
      const response = await api.get('/bitacoras/visitas', {
        params: pickDefined(params, VISIT_PARAM_KEYS),
      });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener visitas');
    }
  },

  async exportVisitas(params = {}) {
    return this.exportExcel(
      '/bitacoras/visitas/excel',
      pickDefined(params, VISIT_PARAM_KEYS),
      'reporte_visitas.xlsx'
    );
  },

  async closeVisita(visitaId) {
    try {
      const response = await api.post(`/bitacoras/visitas/${visitaId}/cerrar`, {});
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al cerrar visita');
    }
  },

  async cancelVisita(visitaId, data = {}) {
    const payload = pickDefined(data, ['motivo']);
    try {
      const response = await api.post(`/bitacoras/visitas/${visitaId}/anular`, payload);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al anular visita');
    }
  },

  async createRegistro(data = {}) {
    const payload = pickDefined(data, [
      'ubicacion_id',
      'manzana_id',
      'villa_id',
      'ocurrido_at',
      'detalle',
    ]);
    try {
      const response = await api.post('/bitacoras/registros', payload);
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al crear registro de Bitácora');
    }
  },

  async getRegistros(params = {}) {
    try {
      const response = await api.get('/bitacoras/registros', {
        params: pickDefined(params, HISTORY_PARAM_KEYS),
      });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener historial de Bitácora');
    }
  },

  async exportRegistros(params = {}) {
    return this.exportExcel(
      '/bitacoras/registros/excel',
      pickDefined(params, HISTORY_PARAM_KEYS),
      'reporte_bitacoras.xlsx'
    );
  },
};

export default bitacorasService;
