import api from './api';
import { buildServiceFailure } from './serviceUtils';

const HISTORY_PARAM_KEYS = [
  'page',
  'pageSize',
  'ubicacion_id',
  'fecha_desde',
  'fecha_hasta',
  'estado',
];

const pickDefined = (source, keys) =>
  keys.reduce((result, key) => {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') result[key] = value;
    return result;
  }, {});

const bitacorasService = {
  async getUbicaciones() {
    try {
      const response = await api.get('/bitacoras/ubicaciones');
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener Ubicaciones de Bitácora');
    }
  },

  async createRegistro(data = {}) {
    const payload = pickDefined(data, ['ubicacion_id', 'ocurrido_at', 'detalle']);
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
};

export default bitacorasService;
