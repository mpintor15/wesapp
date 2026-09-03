const { ESTADOS_COLABORADOR } = require('./personal.constants');

const ESTADOS_COLABORADOR_SET = new Set(ESTADOS_COLABORADOR);

const normalizeEstadoColaborador = (estado) => (estado ? String(estado).trim().toLowerCase() : '');

const isValidEstadoColaborador = (estado) => ESTADOS_COLABORADOR_SET.has(estado);

const buildColaboradoresFilters = ({ search, estado, cargo } = {}) => ({
  search,
  estado: estado ? normalizeEstadoColaborador(estado) : undefined,
  cargo,
});

const buildColaboradorExcelRow = (row) => ({
  nombres_completos: row.nombres_completos,
  cedula: row.cedula,
  fecha_nacimiento: row.fecha_nacimiento
    ? new Date(row.fecha_nacimiento).toLocaleDateString('es-EC')
    : '',
  cargo: row.cargo,
  celular: row.celular || '',
  banco: row.banco || '',
  numero_cuenta: row.numero_cuenta || '',
  sueldo: row.sueldo ? Number.parseFloat(row.sueldo) : '',
  estado: row.estado,
});

module.exports = {
  buildColaboradorExcelRow,
  buildColaboradoresFilters,
  isValidEstadoColaborador,
  normalizeEstadoColaborador,
};
