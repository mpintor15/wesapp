const ESTADOS_COLABORADOR = Object.freeze(['activo', 'inactivo']);

const COLABORADORES_EXCEL_COLUMNS = Object.freeze([
  { header: 'Nombres', key: 'nombres_completos', width: 30 },
  { header: 'Cédula', key: 'cedula', width: 15 },
  { header: 'Fecha Nacimiento', key: 'fecha_nacimiento', width: 16 },
  { header: 'Cargo', key: 'cargo', width: 20 },
  { header: 'Celular', key: 'celular', width: 15 },
  { header: 'Banco', key: 'banco', width: 20 },
  { header: 'Cuenta', key: 'numero_cuenta', width: 20 },
  { header: 'Sueldo', key: 'sueldo', width: 14, numFmt: '$#,##0.00' },
  { header: 'Estado', key: 'estado', width: 12 },
]);

module.exports = {
  COLABORADORES_EXCEL_COLUMNS,
  ESTADOS_COLABORADOR,
};
