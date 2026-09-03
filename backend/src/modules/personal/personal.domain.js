const { ESTADOS_COLABORADOR, PERSONAL_SENSITIVE_FIELDS } = require('./personal.constants');
const { ROLES } = require('../../config/permissions');

const ESTADOS_COLABORADOR_SET = new Set(ESTADOS_COLABORADOR);

// Banco, número de cuenta y sueldo son datos sensibles de nómina: solo
// gerente y secretario pueden verlos o modificarlos. El resto de roles con
// acceso a Personal (contador, supervisor) nunca deben recibirlos ni poder
// escribirlos, ni siquiera vía creación/actualización masiva de campos.
const canAccessPersonalSensitiveFields = (role) =>
  role === ROLES.GERENTE || role === ROLES.SECRETARIO;

const redactColaboradorSensitiveFields = (colaborador, canAccess) => {
  if (canAccess) {
    return colaborador;
  }
  const redacted = { ...colaborador };
  PERSONAL_SENSITIVE_FIELDS.forEach((field) => {
    delete redacted[field];
  });
  return redacted;
};

const stripSensitivePayloadFields = (payload, canAccess) => {
  if (canAccess) {
    return payload;
  }
  const stripped = { ...payload };
  PERSONAL_SENSITIVE_FIELDS.forEach((field) => {
    delete stripped[field];
  });
  return stripped;
};

// Deriva un resumen de acceso al sistema a partir de las columnas
// usuario_* que aporta el LEFT JOIN de personalReadRepository, sin duplicar
// el estado del usuario como una entidad aparte dentro de colaborador.
const buildAccesoSummary = (row) => {
  if (!row.usuario_id) {
    return { tiene_usuario: false };
  }
  return {
    tiene_usuario: true,
    usuario_id: row.usuario_id,
    usuario: row.usuario_usuario,
    tipo_usuario: row.usuario_tipo_usuario,
    activo: row.usuario_activo,
    pendiente: Boolean(row.usuario_primer_login),
  };
};

const USUARIO_JOIN_COLUMNS = [
  'usuario_id',
  'usuario_usuario',
  'usuario_tipo_usuario',
  'usuario_activo',
  'usuario_primer_login',
];

const attachAccesoSummary = (row) => {
  const colaborador = { ...row };
  USUARIO_JOIN_COLUMNS.forEach((field) => {
    delete colaborador[field];
  });
  return { ...colaborador, acceso: buildAccesoSummary(row) };
};

const normalizeEstadoColaborador = (estado) => (estado ? String(estado).trim().toLowerCase() : '');

const isValidEstadoColaborador = (estado) => ESTADOS_COLABORADOR_SET.has(estado);

const buildColaboradoresFilters = ({ search, estado, cargo } = {}) => ({
  search,
  estado: estado ? normalizeEstadoColaborador(estado) : undefined,
  cargo,
});

const buildColaboradorExcelRow = (row, canAccessSensitive = true) => {
  const base = {
    nombres_completos: row.nombres_completos,
    cedula: row.cedula,
    fecha_nacimiento: row.fecha_nacimiento
      ? new Date(row.fecha_nacimiento).toLocaleDateString('es-EC')
      : '',
    cargo: row.cargo,
    celular: row.celular || '',
    estado: row.estado,
  };
  if (!canAccessSensitive) {
    return base;
  }
  return {
    ...base,
    banco: row.banco || '',
    numero_cuenta: row.numero_cuenta || '',
    sueldo: row.sueldo ? Number.parseFloat(row.sueldo) : '',
  };
};

module.exports = {
  attachAccesoSummary,
  buildAccesoSummary,
  buildColaboradorExcelRow,
  buildColaboradoresFilters,
  canAccessPersonalSensitiveFields,
  isValidEstadoColaborador,
  normalizeEstadoColaborador,
  redactColaboradorSensitiveFields,
  stripSensitivePayloadFields,
};
