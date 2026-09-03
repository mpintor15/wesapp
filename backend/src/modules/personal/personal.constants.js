const ESTADOS_COLABORADOR = Object.freeze(['activo', 'inactivo']);

// Solo gerente y secretario pueden ver o modificar estos datos de nómina
// (ver personal.domain.js#canAccessPersonalSensitiveFields).
const PERSONAL_SENSITIVE_FIELDS = Object.freeze(['banco', 'numero_cuenta', 'sueldo']);

const COLABORADORES_EXCEL_COLUMNS_BASE = Object.freeze([
  { header: 'Nombres', key: 'nombres_completos', width: 30 },
  { header: 'Cédula', key: 'cedula', width: 15 },
  { header: 'Fecha Nacimiento', key: 'fecha_nacimiento', width: 16 },
  { header: 'Cargo', key: 'cargo', width: 20 },
  { header: 'Celular', key: 'celular', width: 15 },
]);

const COLABORADORES_EXCEL_COLUMNS_SENSITIVE = Object.freeze([
  { header: 'Banco', key: 'banco', width: 20 },
  { header: 'Cuenta', key: 'numero_cuenta', width: 20 },
  { header: 'Sueldo', key: 'sueldo', width: 14, numFmt: '$#,##0.00' },
]);

const COLABORADORES_EXCEL_COLUMNS_TAIL = Object.freeze([
  { header: 'Estado', key: 'estado', width: 12 },
]);

const COLABORADORES_EXCEL_COLUMNS = Object.freeze([
  ...COLABORADORES_EXCEL_COLUMNS_BASE,
  ...COLABORADORES_EXCEL_COLUMNS_SENSITIVE,
  ...COLABORADORES_EXCEL_COLUMNS_TAIL,
]);

const getColaboradoresExcelColumns = (canAccessSensitive) =>
  canAccessSensitive
    ? COLABORADORES_EXCEL_COLUMNS
    : Object.freeze([...COLABORADORES_EXCEL_COLUMNS_BASE, ...COLABORADORES_EXCEL_COLUMNS_TAIL]);

module.exports = {
  COLABORADORES_EXCEL_COLUMNS,
  ESTADOS_COLABORADOR,
  getColaboradoresExcelColumns,
  PERSONAL_SENSITIVE_FIELDS,
};
