/**
 * visitasCierreAutomaticoService.js — Cierre automático de visitas sin salida
 *
 * Una visita que exige registrar salida y sigue ABIERTA pasados N días (7 por
 * defecto) casi siempre es un olvido del guardia. Se cierra sola, sin inventar
 * una hora de salida, y queda marcada con columnas que ya existen:
 *  - estado = 'CERRADA'
 *  - salida_at = NULL (no hay salida real)
 *  - cerrado_por_usuario_id / cerrado_por_colaborador_id = NULL (un cierre
 *    humano siempre los llena)
 *  - observacion_salida = AUTO_CLOSE_NOTE
 */
const db = require('../config/database');
const logger = require('../config/logger');
const { logAudit } = require('../utils/audit');
const { sanitizeError } = require('../utils/logSanitizer');

const DEFAULT_DAYS = 7;
const RUN_INTERVAL_MS = 60 * 60 * 1000;
const AUDIT_USER_NAME = 'sistema';

const parseDays = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_DAYS;
};

const buildAutoCloseNote = (days) =>
  `Cierre automático: no se registró la salida en ${days} ${days === 1 ? 'día' : 'días'}`;

const closeStaleVisits = async ({ days = DEFAULT_DAYS } = {}) => {
  const maxDays = parseDays(days);
  const note = buildAutoCloseNote(maxDays);

  return db.transaction(async (client) => {
    const result = await client.query(
      `UPDATE bitacora_visitas
       SET estado = 'CERRADA',
           salida_at = NULL,
           cerrado_por_usuario_id = NULL,
           cerrado_por_colaborador_id = NULL,
           salida_bitacora_registro_id = NULL,
           observacion_salida = $2
       WHERE id IN (
         SELECT bv.id
         FROM bitacora_visitas bv
         WHERE bv.estado = 'ABIERTA'
           AND bv.entrada_at < CURRENT_TIMESTAMP - make_interval(days => $1)
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, ubicacion_id, estado, entrada_at, observacion_salida`,
      [maxDays, note]
    );

    for (const visit of result.rows) {
      await logAudit(client, {
        tabla: 'bitacora_visitas',
        operacion: 'UPDATE',
        registro_id: String(visit.id),
        usuario_nombre: AUDIT_USER_NAME,
        datos_anteriores: { estado: 'ABIERTA' },
        datos_nuevos: { ...visit, cierre_automatico: true },
      });
    }

    return result.rows.length;
  });
};

const runOnce = async () => {
  try {
    const closed = await closeStaleVisits({ days: process.env.VISITAS_CIERRE_AUTOMATICO_DIAS });
    if (closed > 0) {
      logger.info(`Cierre automático: ${closed} visita(s) sin salida cerradas`);
    }
  } catch (error) {
    logger.error('Error en el cierre automático de visitas', sanitizeError(error));
  }
};

// Corre al arrancar y luego cada hora. La operación es idempotente, así que
// varias réplicas no se estorban: SKIP LOCKED evita cerrar la misma visita dos veces.
const startScheduler = () => {
  void runOnce();
  const timer = setInterval(runOnce, RUN_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
};

module.exports = { buildAutoCloseNote, closeStaleVisits, startScheduler, DEFAULT_DAYS };
