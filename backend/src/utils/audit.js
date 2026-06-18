/**
 * audit.js — Helper para registrar operaciones en el audit_log
 *
 * logAudit acepta tanto el pool de DB como un cliente de transacción,
 * por lo que puede usarse dentro y fuera de transacciones.
 * Nunca lanza — un fallo de audit no interrumpe la operación principal.
 */
const logger = require('../config/logger');

const logAudit = async (
  dbClient,
  {
    tabla,
    operacion,
    registro_id,
    usuario_id = null,
    usuario_nombre = null,
    datos_anteriores = null,
    datos_nuevos = null,
    ip_address = null,
    user_agent = null,
  }
) => {
  try {
    await dbClient.query(
      `INSERT INTO audit_log
        (tabla, operacion, registro_id, usuario_id, usuario_nombre, datos_anteriores, datos_nuevos, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tabla,
        operacion,
        registro_id || null,
        usuario_id,
        usuario_nombre,
        datos_anteriores ? JSON.stringify(datos_anteriores) : null,
        datos_nuevos ? JSON.stringify(datos_nuevos) : null,
        ip_address,
        user_agent,
      ]
    );
  } catch (err) {
    logger.warn('[audit] Error al escribir en audit_log:', {
      message: err.message,
      code: err.code,
    });
  }
};

const auditFromReq = (req) => ({
  usuario_id: req.user?.id || null,
  usuario_nombre: req.user?.usuario || null,
  ip_address: req.ip || req.connection?.remoteAddress || null,
  user_agent: req.get('user-agent') || null,
});

module.exports = { logAudit, auditFromReq };
