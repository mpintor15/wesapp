/**
 * clientesPortalController.js — Administración del acceso de un cliente al
 * portal de visitas (usuario de tipo 'cliente', máximo uno por cliente).
 */
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { ROLES } = require('../config/permissions');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { logAudit, auditFromReq } = require('../utils/audit');
const { generateTempPassword } = require('../utils/tempPassword');

const USUARIO_COLUMNS =
  'id, usuario, nombre, apellido, tipo_usuario, primer_login, activo, created_at';

const getClienteId = (req) => parsePositiveInteger(req.params.id, 'El id de cliente es inválido');

const lockCliente = async (executor, clienteId) => {
  const result = await executor.query('SELECT id, nombre FROM clientes WHERE id = $1 FOR UPDATE', [
    clienteId,
  ]);
  if (result.rowCount === 0) {
    throw createHttpError(404, 'Cliente no encontrado');
  }
  return result.rows[0];
};

const findPortalUser = async (executor, clienteId, { lock = false } = {}) => {
  const result = await executor.query(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE cliente_id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [clienteId]
  );
  return result.rows[0] || null;
};

const countUrbanizaciones = async (executor, clienteId) => {
  const result = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM ubicaciones
     WHERE cliente_id = $1 AND tipo_punto = 'URBANIZACION'`,
    [clienteId]
  );
  return result.rows[0].total;
};

const getAcceso = async (req, res) => {
  try {
    const clienteId = getClienteId(req);
    await lockCliente(db, clienteId);
    const [usuario, urbanizaciones] = await Promise.all([
      findPortalUser(db, clienteId),
      countUrbanizaciones(db, clienteId),
    ]);
    res.json({
      success: true,
      data: { elegible: urbanizaciones > 0, urbanizaciones, usuario },
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar acceso del cliente:');
  }
};

const createAcceso = async (req, res) => {
  try {
    const clienteId = getClienteId(req);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    let created;
    await db.transaction(async (client) => {
      const cliente = await lockCliente(client, clienteId);
      if ((await countUrbanizaciones(client, clienteId)) === 0) {
        throw createHttpError(400, 'El cliente no tiene ubicaciones de tipo urbanización');
      }
      if (await findPortalUser(client, clienteId)) {
        throw createHttpError(409, 'El cliente ya tiene un usuario de acceso');
      }
      const result = await client.query(
        `INSERT INTO usuarios
           (usuario, password_hash, nombre, apellido, tipo_usuario, cliente_id, primer_login, activo)
         VALUES ($1, $2, $3, NULL, $4, $5, TRUE, TRUE)
         RETURNING ${USUARIO_COLUMNS}`,
        [req.body.usuario, passwordHash, cliente.nombre.slice(0, 100), ROLES.CLIENTE, clienteId]
      );
      created = result.rows[0];
      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'INSERT',
        registro_id: String(created.id),
        datos_nuevos: { ...created, cliente_id: clienteId },
        ...auditFromReq(req),
      });
    });

    res.status(201).json({
      success: true,
      message: 'Acceso creado exitosamente',
      data: { ...created, temp_password: tempPassword },
    });
  } catch (error) {
    if (error.code === '23505') {
      const conflict = createHttpError(
        409,
        error.constraint === 'usuarios_cliente_id_key'
          ? 'El cliente ya tiene un usuario de acceso'
          : 'El nombre de usuario ya existe'
      );
      return handleControllerError(res, conflict, 'Error al crear acceso del cliente:');
    }
    return handleControllerError(res, error, 'Error al crear acceso del cliente:');
  }
};

const updateAcceso = async (req, res) => {
  try {
    const clienteId = getClienteId(req);
    let updated;
    await db.transaction(async (client) => {
      await lockCliente(client, clienteId);
      const current = await findPortalUser(client, clienteId, { lock: true });
      if (!current) {
        throw createHttpError(404, 'El cliente no tiene usuario de acceso');
      }
      const result = await client.query(
        `UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING ${USUARIO_COLUMNS}`,
        [req.body.activo, current.id]
      );
      updated = result.rows[0];
      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'UPDATE',
        registro_id: String(current.id),
        datos_anteriores: current,
        datos_nuevos: updated,
        ...auditFromReq(req),
      });
    });
    res.json({ success: true, message: 'Acceso actualizado exitosamente', data: updated });
  } catch (error) {
    return handleControllerError(res, error, 'Error al actualizar acceso del cliente:');
  }
};

const resetAcceso = async (req, res) => {
  try {
    const clienteId = getClienteId(req);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    let updated;
    await db.transaction(async (client) => {
      await lockCliente(client, clienteId);
      const current = await findPortalUser(client, clienteId, { lock: true });
      if (!current) {
        throw createHttpError(404, 'El cliente no tiene usuario de acceso');
      }
      const result = await client.query(
        `UPDATE usuarios
         SET password_hash = $1, primer_login = TRUE, intentos_fallidos = 0, bloqueado_hasta = NULL
         WHERE id = $2
         RETURNING ${USUARIO_COLUMNS}`,
        [passwordHash, current.id]
      );
      updated = result.rows[0];
      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'UPDATE',
        registro_id: String(current.id),
        datos_anteriores: current,
        datos_nuevos: { ...updated, contrasena_restablecida: true },
        ...auditFromReq(req),
      });
    });
    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      data: { ...updated, temp_password: tempPassword },
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al restablecer acceso del cliente:');
  }
};

const deleteAcceso = async (req, res) => {
  try {
    const clienteId = getClienteId(req);
    await db.transaction(async (client) => {
      await lockCliente(client, clienteId);
      const current = await findPortalUser(client, clienteId, { lock: true });
      if (!current) {
        throw createHttpError(404, 'El cliente no tiene usuario de acceso');
      }
      await client.query('DELETE FROM usuarios WHERE id = $1', [current.id]);
      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'DELETE',
        registro_id: String(current.id),
        datos_anteriores: { ...current, cliente_id: clienteId },
        ...auditFromReq(req),
      });
    });
    res.json({ success: true, message: 'Acceso eliminado exitosamente' });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar acceso del cliente:');
  }
};

module.exports = { getAcceso, createAcceso, updateAcceso, resetAcceso, deleteAcceso };
