const db = require('../../config/database');

const updateMovimientoPdfPath = (movimientoId, relativePath, executor = db) =>
  executor.query('UPDATE movimientos SET pdf_path = $1 WHERE id = $2', [
    relativePath,
    movimientoId,
  ]);

module.exports = {
  updateMovimientoPdfPath,
};
