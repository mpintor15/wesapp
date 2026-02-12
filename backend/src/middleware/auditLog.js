const db = require('../config/database');

/**
 * Middleware para registrar operaciones de auditoría
 * Registra automáticamente las operaciones en la tabla audit_log
 */

const auditLog = (tabla, operacion) => {
  return async (req, res, next) => {
    // Guardar el método original res.json
    const originalJson = res.json.bind(res);

    // Sobrescribir res.json para capturar la respuesta
    res.json = function(data) {
      // Solo registrar si la operación fue exitosa
      if (data.success) {
        // No esperar (fire and forget) para no bloquear la respuesta
        setImmediate(async () => {
          try {
            const registroId = extractRecordId(req, data, operacion);
            const datosAnteriores = req.datosAnteriores || null; // Set by specific routes if needed
            const datosNuevos = extractNewData(req, data, operacion);

            await db.query(
              `INSERT INTO audit_log
                (tabla, operacion, registro_id, usuario_id, usuario_nombre, datos_anteriores, datos_nuevos, ip_address, user_agent)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                tabla,
                operacion,
                registroId,
                req.user?.id || null,
                req.user?.nombre || 'Sistema',
                datosAnteriores ? JSON.stringify(datosAnteriores) : null,
                datosNuevos ? JSON.stringify(datosNuevos) : null,
                req.ip || req.connection.remoteAddress,
                req.get('user-agent') || null
              ]
            );
          } catch (error) {
            // Log error pero no fallar la request del usuario
            console.error('Error al registrar auditoría:', error);
          }
        });
      }

      // Llamar al método original
      return originalJson(data);
    };

    next();
  };
};

/**
 * Extrae el ID del registro de la request o response
 */
const extractRecordId = (req, data, operacion) => {
  // Para DELETE y UPDATE, el ID está en los params
  if (req.params.id) return parseInt(req.params.id);
  if (req.params.num_factura) return parseInt(req.params.num_factura);

  // Para INSERT, el ID está en la respuesta
  if (operacion === 'INSERT' && data.data) {
    return data.data.id || data.data.num_factura || null;
  }

  return null;
};

/**
 * Extrae los datos nuevos del body de la request
 */
const extractNewData = (req, data, operacion) => {
  if (operacion === 'INSERT' || operacion === 'UPDATE') {
    // Excluir campos sensibles
    const { password, token, ...safeData } = req.body || {};
    return safeData;
  }
  return null;
};

/**
 * Middleware para capturar datos anteriores antes de UPDATE/DELETE
 * Debe usarse ANTES del auditLog middleware
 */
const captureBeforeData = (tabla, idField = 'id') => {
  return async (req, res, next) => {
    try {
      const id = req.params[idField] || req.params.id;
      if (!id) return next();

      const result = await db.query(`SELECT * FROM ${tabla} WHERE ${idField} = $1`, [id]);

      if (result.rows.length > 0) {
        req.datosAnteriores = result.rows[0];
      }
    } catch (error) {
      console.error('Error al capturar datos anteriores:', error);
    }
    next();
  };
};

/**
 * Función helper para obtener historial de auditoría
 */
const getAuditHistory = async (tabla, registroId, limit = 50) => {
  try {
    const result = await db.query(
      `SELECT * FROM audit_log
       WHERE tabla = $1 AND registro_id = $2
       ORDER BY fecha_hora DESC
       LIMIT $3`,
      [tabla, registroId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error al obtener historial de auditoría:', error);
    return [];
  }
};

/**
 * Función para limpiar logs antiguos (mantenimiento)
 */
const cleanOldAuditLogs = async (daysToKeep = 365) => {
  try {
    const result = await db.query(
      `DELETE FROM audit_log
       WHERE fecha_hora < NOW() - INTERVAL '${daysToKeep} days'`
    );
    console.log(`🧹 Limpieza de audit_log: ${result.rowCount} registros eliminados`);
    return result.rowCount;
  } catch (error) {
    console.error('Error al limpiar logs de auditoría:', error);
    return 0;
  }
};

module.exports = {
  auditLog,
  captureBeforeData,
  getAuditHistory,
  cleanOldAuditLogs
};
