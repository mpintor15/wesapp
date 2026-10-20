/**
 * portalService.js — Portal de clientes (solo lectura)
 *
 *  - getUbicaciones() : GET /portal/ubicaciones  Urbanizaciones del cliente autenticado.
 *  - getVisitas(params): GET /portal/visitas     Visitas de esas urbanizaciones.
 */
import api from './api';
import { buildServiceFailure } from './serviceUtils';

const VISIT_PARAM_KEYS = [
  'page',
  'pageSize',
  'ubicacion_id',
  'estado',
  'creator',
  'fecha_desde',
  'fecha_hasta',
  'search',
  'sortBy',
  'sortOrder',
];

const pickDefined = (source, keys) =>
  keys.reduce((result, key) => {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') result[key] = value;
    return result;
  }, {});

const portalService = {
  async getUbicaciones() {
    try {
      const response = await api.get('/portal/ubicaciones');
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener urbanizaciones');
    }
  },

  async getVisitas(params = {}) {
    try {
      const response = await api.get('/portal/visitas', {
        params: pickDefined(params, VISIT_PARAM_KEYS),
      });
      return response.data;
    } catch (error) {
      return buildServiceFailure(error, 'Error al obtener visitas');
    }
  },
};

export default portalService;
