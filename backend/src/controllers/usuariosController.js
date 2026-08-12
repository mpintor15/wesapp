const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const db = require('../config/database');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { clearActiveCache } = require('../middleware/permissions');
const { logAudit, auditFromReq } = require('../utils/audit');
const { assertUsuarioWithoutActivity } = require('../services/usuariosDeletionService');

const ALLOWED_TYPES = new Set([
  'gerente',
  'secretario',
  'supervisor',
  'contador',
  'guardia',
  'monitorista',
]);
const ROLE_GERENTE = 'gerente';
const COLABORADOR_CONFLICT_MESSAGE = 'El colaborador ya está vinculado a otro usuario';

const generateTempPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const buf = crypto.randomBytes(16);

  const chars = [
    upper[buf[0] % upper.length],
    lower[buf[1] % lower.length],
    digits[buf[2] % digits.length],
  ];
  for (let i = 3; i < 10; i++) {
    chars.push(all[buf[i] % all.length]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const getUsuarioSummaryById = async (id) => {
  const result = await db.query(
    'SELECT id, tipo_usuario, activo, colaborador_id FROM usuarios WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
};

const getActiveGerentesCount = async () => {
  const result = await db.query(
    'SELECT COUNT(*)::int AS total FROM usuarios WHERE tipo_usuario = $1 AND activo = TRUE',
    [ROLE_GERENTE]
  );
  return Number(result.rows[0]?.total || 0);
};

// ============================================
// USUARIOS
// ============================================

const getUsuarios = async (req, res) => {
  try {
    const { search, tipo_usuario, activo } = req.query;
    let query = `
      SELECT u.id, u.usuario, u.nombre, u.apellido, u.tipo_usuario, u.primer_login, u.activo,
             u.created_at, u.colaborador_id, c.nombres_completos AS colaborador_nombre,
             c.estado AS colaborador_estado
      FROM usuarios u
      LEFT JOIN colaboradores c ON c.id = u.colaborador_id
    `;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(u.usuario ILIKE $${params.length} OR u.nombre ILIKE $${params.length} OR u.apellido ILIKE $${params.length})`
      );
    }

    if (tipo_usuario) {
      const normalizedTipo = String(tipo_usuario).trim().toLowerCase();
      if (!ALLOWED_TYPES.has(normalizedTipo)) {
        throw createHttpError(400, 'Filtro tipo_usuario inválido');
      }
      params.push(normalizedTipo);
      conditions.push(`u.tipo_usuario = $${params.length}`);
    }

    if (activo === 'pendiente' || activo === 'pending') {
      conditions.push('u.primer_login = TRUE');
    } else if (activo === 'true') {
      params.push(true);
      conditions.push(`u.activo = $${params.length} AND u.primer_login = FALSE`);
    } else if (activo === 'false') {
      params.push(activo === 'true');
      conditions.push(`u.activo = $${params.length}`);
    } else if (activo !== undefined) {
      throw createHttpError(400, 'Filtro activo inválido. Usa true, false o pendiente');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY u.apellido ASC, u.nombre ASC, u.usuario ASC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener usuarios:');
  }
};

const getColaboradoresElegibles = async (req, res) => {
  try {
    const usuarioId =
      req.query.usuario_id === undefined
        ? null
        : parsePositiveInteger(req.query.usuario_id, 'El id de usuario es inválido');
    const result = await db.query(
      `SELECT c.id, c.nombres_completos, c.cedula, c.cargo, c.estado
       FROM colaboradores c
       LEFT JOIN usuarios u ON u.colaborador_id = c.id
       WHERE (c.estado = 'activo' AND u.id IS NULL)
          OR ($1::integer IS NOT NULL AND u.id = $1)
       ORDER BY c.nombres_completos ASC`,
      [usuarioId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener colaboradores elegibles:');
  }
};

const assertEligibleColaborador = async (executor, colaboradorId, currentUsuarioId = null) => {
  if (colaboradorId === null || colaboradorId === undefined) {
    return;
  }
  const result = await executor.query(
    `SELECT c.id, c.estado, u.id AS usuario_id
     FROM colaboradores c
     LEFT JOIN usuarios u ON u.colaborador_id = c.id
     WHERE c.id = $1
     FOR UPDATE OF c`,
    [colaboradorId]
  );
  const colaborador = result.rows[0];
  if (!colaborador) {
    throw createHttpError(400, 'El colaborador seleccionado no existe');
  }
  if (colaborador.usuario_id && Number(colaborador.usuario_id) !== Number(currentUsuarioId)) {
    throw createHttpError(409, COLABORADOR_CONFLICT_MESSAGE);
  }
  if (
    colaborador.estado !== 'activo' &&
    (!currentUsuarioId || Number(colaborador.usuario_id) !== Number(currentUsuarioId))
  ) {
    throw createHttpError(400, 'No se puede vincular un colaborador inactivo');
  }
};

const createUsuario = async (req, res) => {
  try {
    const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '';
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const apellido = typeof req.body?.apellido === 'string' ? req.body.apellido.trim() : '';
    const tipoUsuario =
      typeof req.body?.tipo_usuario === 'string' ? req.body.tipo_usuario.trim().toLowerCase() : '';
    const colaboradorId = req.body?.colaborador_id ?? null;

    if (!usuario || !tipoUsuario || !nombre || !apellido) {
      return res.status(400).json({
        success: false,
        message: 'Usuario, nombre, apellido y tipo de usuario son requeridos',
      });
    }

    if (!ALLOWED_TYPES.has(tipoUsuario)) {
      return res.status(400).json({ success: false, message: 'Tipo de usuario inválido' });
    }

    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, 10);

    let createdUsuario;
    await db.transaction(async (client) => {
      await assertEligibleColaborador(client, colaboradorId);
      const result = await client.query(
        `INSERT INTO usuarios
           (usuario, password_hash, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
         RETURNING id, usuario, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo`,
        [usuario, password_hash, nombre, apellido, tipoUsuario, colaboradorId]
      );
      createdUsuario = result.rows[0];
      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'INSERT',
        registro_id: String(createdUsuario.id),
        datos_nuevos: createdUsuario,
        ...auditFromReq(req),
      });
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: { ...createdUsuario, temp_password: tempPassword },
    });
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'usuarios_colaborador_id_key') {
        return res.status(409).json({ success: false, message: COLABORADOR_CONFLICT_MESSAGE });
      }
      return res.status(409).json({ success: false, message: 'El nombre de usuario ya existe' });
    }
    return handleControllerError(res, error, 'Error al crear usuario:');
  }
};

const buildUpdateFields = (body, currentUserId, targetId) => {
  const updates = [];
  const values = [];

  const tipoUsuario =
    typeof body?.tipo_usuario === 'string' ? body.tipo_usuario.trim().toLowerCase() : null;
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : null;
  const apellido = typeof body?.apellido === 'string' ? body.apellido.trim() : null;
  const { activo } = body ?? {};
  const hasColaboradorId = Object.prototype.hasOwnProperty.call(body ?? {}, 'colaborador_id');
  const colaboradorId = hasColaboradorId ? body.colaborador_id : undefined;

  if (tipoUsuario) {
    if (!ALLOWED_TYPES.has(tipoUsuario)) {
      throw createHttpError(400, 'Tipo de usuario inválido');
    }
    updates.push(`tipo_usuario = $${values.length + 1}`);
    values.push(tipoUsuario);
  }
  if (nombre) {
    updates.push(`nombre = $${values.length + 1}`);
    values.push(nombre);
  }
  if (apellido) {
    updates.push(`apellido = $${values.length + 1}`);
    values.push(apellido);
  }

  if (typeof activo === 'boolean') {
    if (Number(currentUserId) === targetId && !activo) {
      throw createHttpError(400, 'No puedes desactivar tu propio usuario');
    }
    updates.push(`activo = $${values.length + 1}`);
    values.push(activo);
  }
  if (hasColaboradorId) {
    updates.push(`colaborador_id = $${values.length + 1}`);
    values.push(colaboradorId);
  }

  return { updates, values, tipoUsuario, activo, colaboradorId, hasColaboradorId };
};

const assertGerenteNotLastActive = async (currentUser, nextTipo, nextActivo) => {
  if (currentUser.tipo_usuario !== ROLE_GERENTE) {
    return;
  }
  if (nextActivo && nextTipo === ROLE_GERENTE) {
    return;
  }
  const count = await getActiveGerentesCount();
  if (count <= 1) {
    throw createHttpError(400, 'Debe existir al menos un gerente activo en el sistema');
  }
};

const updateUsuario = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'El id de usuario es inválido');

    const currentUser = await getUsuarioSummaryById(id);
    if (!currentUser) {
      throw createHttpError(404, 'Usuario no encontrado');
    }

    const { updates, values, tipoUsuario, activo, colaboradorId, hasColaboradorId } =
      buildUpdateFields(req.body, req.user?.id, id);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    const nextTipo = tipoUsuario || currentUser.tipo_usuario;
    const nextActivo = typeof activo === 'boolean' ? activo : currentUser.activo;
    await assertGerenteNotLastActive(currentUser, nextTipo, nextActivo);

    let updatedUsuario;
    await db.transaction(async (client) => {
      if (hasColaboradorId && colaboradorId !== currentUser.colaborador_id) {
        await assertEligibleColaborador(client, colaboradorId, id);
      }
      values.push(id);
      const result = await client.query(
        `UPDATE usuarios SET ${updates.join(', ')}
         WHERE id = $${values.length}
         RETURNING id, usuario, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo`,
        values
      );
      updatedUsuario = result.rows[0];
      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'UPDATE',
        registro_id: String(id),
        datos_anteriores: currentUser,
        datos_nuevos: updatedUsuario,
        ...auditFromReq(req),
      });
    });

    clearActiveCache(id);
    res.json({ success: true, message: 'Usuario actualizado exitosamente', data: updatedUsuario });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'usuarios_colaborador_id_key') {
      return res.status(409).json({ success: false, message: COLABORADOR_CONFLICT_MESSAGE });
    }
    return handleControllerError(res, error, 'Error al actualizar usuario:');
  }
};

const reenviarInvitacion = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'El id de usuario es inválido');

    const currentUser = await db.query(
      `SELECT id, usuario, nombre, apellido, tipo_usuario, primer_login, activo
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const user = currentUser.rows[0];
    if (!user) {
      throw createHttpError(404, 'Usuario no encontrado');
    }
    if (!user.primer_login) {
      throw createHttpError(400, 'Este usuario ya completó su primer acceso');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const result = await db.query(
      `UPDATE usuarios
       SET password_hash = $1, primer_login = TRUE
       WHERE id = $2
       RETURNING id, usuario, nombre, apellido, tipo_usuario, primer_login, activo`,
      [passwordHash, id]
    );

    await logAudit(db, {
      tabla: 'usuarios',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: user,
      datos_nuevos: { ...result.rows[0], invitacion_reenviada: true },
      ...auditFromReq(req),
    });

    res.json({
      success: true,
      message: 'Invitación regenerada exitosamente',
      data: { ...result.rows[0], temp_password: tempPassword },
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al reenviar invitación:');
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'El id de usuario es inválido');

    if (Number(req.user?.id) === id) {
      throw createHttpError(400, 'No puedes eliminar tu propio usuario');
    }

    let userToDelete = null;
    await db.transaction(async (client) => {
      const current = await client.query(
        'SELECT id, tipo_usuario, activo FROM usuarios WHERE id = $1 FOR UPDATE',
        [id]
      );
      userToDelete = current.rows[0] || null;
      if (!userToDelete) {
        throw createHttpError(404, 'Usuario no encontrado');
      }

      if (userToDelete.tipo_usuario === ROLE_GERENTE && userToDelete.activo) {
        const activeGerentes = await client.query(
          `SELECT id
          FROM usuarios
          WHERE tipo_usuario = $1
            AND activo = TRUE
          FOR UPDATE`,
          [ROLE_GERENTE]
        );

        if (activeGerentes.rowCount <= 1) {
          throw createHttpError(400, 'Debe existir al menos un gerente activo en el sistema');
        }
      }

      await assertUsuarioWithoutActivity(client, id);

      const result = await client.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) {
        throw createHttpError(404, 'Usuario no encontrado');
      }

      await logAudit(client, {
        tabla: 'usuarios',
        operacion: 'DELETE',
        registro_id: String(id),
        datos_anteriores: userToDelete,
        ...auditFromReq(req),
      });
    });

    clearActiveCache(id);
    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    if (error.code === '23503') {
      const fkError = createHttpError(
        409,
        'El usuario tiene actividad registrada y no puede eliminarse. Desactívalo para conservar el historial.'
      );
      fkError.appCode = 'USER_HAS_ACTIVITY';
      fkError.code = 'USER_HAS_ACTIVITY';
      return handleControllerError(res, fkError, 'Error al eliminar usuario:');
    }
    return handleControllerError(res, error, 'Error al eliminar usuario:');
  }
};

module.exports = {
  getUsuarios,
  getColaboradoresElegibles,
  createUsuario,
  updateUsuario,
  reenviarInvitacion,
  deleteUsuario,
};
