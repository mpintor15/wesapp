const db = require('../config/database');
const logger = require('../config/logger');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { parseStrictPositiveInteger } = require('../utils/inputValidation');

const normalizeName = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const parseId = (value) => {
  const result = parseStrictPositiveInteger(value, 'La ubicación es inválida');
  return result.valid ? result.value : null;
};

const sendError = (res, error, fallback) => {
  logger.error(fallback, { message: error.message, code: error.code, status: error.status });
  if (error.code === '23505') {
    return res
      .status(409)
      .json({ success: false, message: 'Ya existe una ubicación con ese nombre' });
  }
  if (error.code === '23503') {
    return res.status(409).json({
      success: false,
      message: 'No se puede eliminar la ubicación porque está asociada a registros de inventario.',
    });
  }
  return res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : 'Error en el servidor',
  });
};

const validateName = (value) => {
  const nombre = normalizeName(value);
  if (!nombre) {
    const error = new Error('El nombre de la ubicación es obligatorio');
    error.status = 400;
    throw error;
  }
  if (nombre.length > 100) {
    const error = new Error('El nombre no puede exceder 100 caracteres');
    error.status = 400;
    throw error;
  }
  return nombre;
};

const getUbicaciones = async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.nombre,
        COUNT(a.id) FILTER (WHERE a.activo = TRUE)::int AS articulos_activos,
        COUNT(a.id)::int AS articulos_totales
      FROM ubicaciones u
      LEFT JOIN articulos a ON a.ubicacion_id = u.id
      GROUP BY u.id, u.nombre
      ORDER BY u.nombre ASC
    `);

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error, 'Error al obtener ubicaciones');
  }
};

const createUbicacion = async (req, res) => {
  try {
    const nombre = validateName(req.body?.nombre);
    const created = await db.transaction(async (client) => {
      const duplicate = await client.query(
        'SELECT id FROM ubicaciones WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1)) LIMIT 1',
        [nombre]
      );
      if (duplicate.rowCount > 0) {
        const error = new Error('Ya existe una ubicación con ese nombre');
        error.status = 409;
        throw error;
      }

      const result = await client.query(
        'INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING id, nombre',
        [nombre]
      );
      const row = result.rows[0];
      await logAuditStrict(client, {
        tabla: 'ubicaciones',
        operacion: 'INSERT',
        registro_id: row.id,
        datos_nuevos: row,
        ...auditFromReq(req),
      });
      return row;
    });

    return res.status(201).json({
      success: true,
      message: 'Ubicación creada exitosamente',
      data: { ...created, articulos_activos: 0, articulos_totales: 0 },
    });
  } catch (error) {
    return sendError(res, error, 'Error al crear ubicación');
  }
};

const updateUbicacion = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'La ubicación es inválida' });
    }
    const nombre = validateName(req.body?.nombre);

    const updated = await db.transaction(async (client) => {
      const current = await client.query(
        'SELECT id, nombre FROM ubicaciones WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (current.rowCount === 0) {
        const error = new Error('Ubicación no encontrada');
        error.status = 404;
        throw error;
      }

      const duplicate = await client.query(
        'SELECT id FROM ubicaciones WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1',
        [nombre, id]
      );
      if (duplicate.rowCount > 0) {
        const error = new Error('Ya existe una ubicación con ese nombre');
        error.status = 409;
        throw error;
      }

      const result = await client.query(
        'UPDATE ubicaciones SET nombre = $1 WHERE id = $2 RETURNING id, nombre',
        [nombre, id]
      );
      await logAuditStrict(client, {
        tabla: 'ubicaciones',
        operacion: 'UPDATE',
        registro_id: id,
        datos_anteriores: current.rows[0],
        datos_nuevos: result.rows[0],
        ...auditFromReq(req),
      });
      return result.rows[0];
    });

    return res.json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Error al actualizar ubicación');
  }
};

const deleteUbicacion = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'La ubicación es inválida' });
    }

    const deleted = await db.transaction(async (client) => {
      const current = await client.query(
        'SELECT id, nombre FROM ubicaciones WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (current.rowCount === 0) {
        const error = new Error('Ubicación no encontrada');
        error.status = 404;
        throw error;
      }

      const usage = await client.query(
        'SELECT COUNT(*)::int AS total FROM articulos WHERE ubicacion_id = $1',
        [id]
      );
      if (usage.rows[0].total > 0) {
        const error = new Error(
          'No se puede eliminar la ubicación porque tiene artículos asociados. Reasígnalos primero.'
        );
        error.status = 409;
        throw error;
      }

      await client.query('DELETE FROM ubicaciones WHERE id = $1', [id]);
      await logAuditStrict(client, {
        tabla: 'ubicaciones',
        operacion: 'DELETE',
        registro_id: id,
        datos_anteriores: current.rows[0],
        ...auditFromReq(req),
      });
      return current.rows[0];
    });

    return res.json({ success: true, message: 'Ubicación eliminada exitosamente', data: deleted });
  } catch (error) {
    return sendError(res, error, 'Error al eliminar ubicación');
  }
};

module.exports = {
  getUbicaciones,
  createUbicacion,
  updateUbicacion,
  deleteUbicacion,
};
