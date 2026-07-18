const db = require('../config/database');

const findAbonosByFactura = (numFactura, executor = db) =>
  executor.query(
    `SELECT
       a.id,
       a.pago_id,
       a.fecha_abono,
       a.valor_abono,
       p.fecha AS fecha_pago,
       p.metodo_pago,
       p.referencia,
       p.notas,
       p.total AS pago_total,
       CASE
         WHEN a.pago_id IS NULL THEN 1
         ELSE (
           SELECT COUNT(*)
           FROM abonos a2
           WHERE a2.pago_id = a.pago_id
         )
       END AS pago_facturas_count
     FROM abonos a
     LEFT JOIN pagos p ON p.id = a.pago_id
     WHERE a.num_factura = $1
     ORDER BY a.fecha_abono DESC, a.id DESC`,
    [numFactura]
  );

const findAbonoForDeletion = (id, executor = db) =>
  executor.query('SELECT id, pago_id, num_factura, valor_abono FROM abonos WHERE id = $1', [id]);

const createAbono = ({ pagoId, numFactura, fechaAbono, valorAbono }, executor = db) =>
  executor.query(
    'INSERT INTO abonos (pago_id, num_factura, fecha_abono, valor_abono) VALUES ($1, $2, $3, $4)',
    [pagoId, numFactura, fechaAbono, valorAbono]
  );

const deleteAbonoById = (id, executor = db) =>
  executor.query('DELETE FROM abonos WHERE id = $1', [id]);

const countAbonosByPagoId = (pagoId, executor = db) =>
  executor.query('SELECT COUNT(*) AS cnt FROM abonos WHERE pago_id = $1', [pagoId]);

module.exports = {
  countAbonosByPagoId,
  createAbono,
  deleteAbonoById,
  findAbonosByFactura,
  findAbonoForDeletion,
};
