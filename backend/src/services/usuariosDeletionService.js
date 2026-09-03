const { createHttpError } = require('../utils/http');

const USER_HAS_ACTIVITY_MESSAGE =
  'El usuario tiene actividad registrada y no puede eliminarse. Desactívalo para conservar el historial.';

const toCount = (value) => Number(value || 0);

const createUserHasActivityError = (details) => {
  const error = createHttpError(409, USER_HAS_ACTIVITY_MESSAGE);
  error.appCode = 'USER_HAS_ACTIVITY';
  error.code = 'USER_HAS_ACTIVITY';
  error.details = details;
  return error;
};

const getUsuarioActivityCounts = async (executor, usuarioId) => {
  const result = await executor.query(
    `SELECT
       (SELECT COUNT(*)::int FROM movimientos WHERE usuario_id = $1) AS movimientos,
       (SELECT COUNT(*)::int FROM movimientos WHERE anulado_por = $1) AS movimientos_anulados,
       (SELECT COUNT(*)::int FROM movimientos WHERE eliminado_por = $1) AS movimientos_eliminados,
       (SELECT COUNT(*)::int FROM articulos_bajas WHERE usuario_id = $1) AS bajas,
       (SELECT COUNT(*)::int FROM articulos_bajas WHERE anulado_por = $1) AS bajas_anuladas,
       (SELECT COUNT(*)::int FROM articulos_bajas WHERE eliminado_por = $1) AS bajas_eliminadas,
       (SELECT COUNT(*)::int
        FROM bitacora_registros
        WHERE autor_usuario_id = $1) AS bitacoras_autor,
       (SELECT COUNT(*)::int
        FROM bitacora_registros
        WHERE anulado_por_usuario_id = $1) AS bitacoras_anuladas,
       (SELECT COUNT(*)::int FROM audit_log WHERE usuario_id = $1) AS audit_log`,
    [usuarioId]
  );

  const row = result.rows[0] || {};
  return {
    movimientos: toCount(row.movimientos),
    movimientos_anulados: toCount(row.movimientos_anulados),
    movimientos_eliminados: toCount(row.movimientos_eliminados),
    bajas: toCount(row.bajas),
    bajas_anuladas: toCount(row.bajas_anuladas),
    bajas_eliminadas: toCount(row.bajas_eliminadas),
    bitacoras_autor: toCount(row.bitacoras_autor),
    bitacoras_anuladas: toCount(row.bitacoras_anuladas),
    audit_log: toCount(row.audit_log),
  };
};

const hasActivity = (counts) => Object.values(counts).some((count) => count > 0);

const assertUsuarioWithoutActivity = async (executor, usuarioId) => {
  const counts = await getUsuarioActivityCounts(executor, usuarioId);
  if (hasActivity(counts)) {
    throw createUserHasActivityError(counts);
  }
  return counts;
};

module.exports = {
  USER_HAS_ACTIVITY_MESSAGE,
  assertUsuarioWithoutActivity,
  createUserHasActivityError,
  getUsuarioActivityCounts,
};
