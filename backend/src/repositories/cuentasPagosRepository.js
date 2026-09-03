const db = require('../config/database');

const findPagosForExport = ({ fecha_inicio, fecha_fin, metodo_pago } = {}, executor = db) => {
  const conditions = [];
  const params = [];

  if (fecha_inicio && fecha_fin) {
    params.push(fecha_inicio, fecha_fin);
    conditions.push(`p.fecha BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (metodo_pago) {
    params.push(metodo_pago);
    conditions.push(`LOWER(COALESCE(p.metodo_pago, '')) = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executor.query(
    `SELECT
       p.id,
       p.fecha,
       COALESCE(cl.nombre, '-') AS cliente,
       COALESCE(p.metodo_pago, '-') AS metodo_pago,
       COALESCE(p.notas, '') AS notas,
       p.total,
       STRING_AGG(
         '#' || a.num_factura::text || ' (' || TO_CHAR(a.valor_abono, 'FM999999990.00') || ')',
         ', ' ORDER BY a.num_factura
       ) AS facturas
     FROM pagos p
     JOIN clientes cl ON cl.id = p.cliente_id
     LEFT JOIN abonos a ON a.pago_id = p.id
     ${where}
     GROUP BY p.id, cl.nombre
     ORDER BY p.fecha DESC, p.id DESC`,
    params
  );
};

const findPagoForDeletion = (id, executor = db) =>
  executor.query(
    `SELECT
       p.id,
       p.cliente_id,
       p.fecha,
       p.metodo_pago,
       p.referencia,
       p.notas,
       p.total,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'id', a.id,
             'num_factura', a.num_factura,
             'fecha_abono', a.fecha_abono,
             'valor_abono', a.valor_abono
           )
           ORDER BY a.id
         ) FILTER (WHERE a.id IS NOT NULL),
         '[]'::json
       ) AS abonos
     FROM pagos p
     LEFT JOIN abonos a ON a.pago_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [id]
  );

const createPago = ({ clienteId, fecha, metodoPago, referencia, notas, total }, executor = db) =>
  executor.query(
    'INSERT INTO pagos (cliente_id, fecha, metodo_pago, referencia, notas, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [clienteId, fecha, metodoPago, referencia, notas, total]
  );

const updatePagoTotalFromAbonos = (id, executor = db) =>
  executor.query(
    'UPDATE pagos SET total = (SELECT COALESCE(SUM(valor_abono), 0) FROM abonos WHERE pago_id = $1) WHERE id = $1',
    [id]
  );

module.exports = {
  createPago,
  findPagoForDeletion,
  findPagosForExport,
  updatePagoTotalFromAbonos,
};
