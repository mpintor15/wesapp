const db = require('../../config/database');

const insertColaborador = (
  {
    nombresCompletos,
    cedula,
    fechaNacimiento,
    cargo,
    celular,
    banco,
    numeroCuenta,
    sueldo,
    estado,
  },
  executor = db
) =>
  executor.query(
    `INSERT INTO colaboradores (
      nombres_completos,
      cedula,
      fecha_nacimiento,
      cargo,
      celular,
      banco,
      numero_cuenta,
      sueldo,
      estado
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [nombresCompletos, cedula, fechaNacimiento, cargo, celular, banco, numeroCuenta, sueldo, estado]
  );

const findColaboradorEstadoSalida = (id, executor = db) =>
  executor.query(
    'SELECT estado, fecha_salida, salida_voluntaria FROM colaboradores WHERE id = $1',
    [id]
  );

// `updates` son fragmentos "columna = $N" ya armados por el controlador (que
// decide qué campos son editables según permisos y validación); este
// repositorio solo arma y ejecuta el UPDATE final.
const updateColaboradorFields = ({ updates, values, id }, executor = db) => {
  const allValues = [...values, id];
  return executor.query(
    `UPDATE colaboradores SET ${updates.join(', ')}
     WHERE id = $${allValues.length}
     RETURNING *`,
    allValues
  );
};

const deleteColaborador = (id, executor = db) =>
  executor.query('DELETE FROM colaboradores WHERE id = $1 RETURNING *', [id]);

module.exports = {
  insertColaborador,
  findColaboradorEstadoSalida,
  updateColaboradorFields,
  deleteColaborador,
};
