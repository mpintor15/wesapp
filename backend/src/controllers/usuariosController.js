const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const db = require('../config/database');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { clearActiveCache } = require('../middleware/permissions');
const { logAudit, auditFromReq } = require('../utils/audit');

const ALLOWED_TYPES = new Set(['gerente', 'secretario', 'supervisor', 'contador']);
const ROLE_GERENTE = 'gerente';

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
    'SELECT id, tipo_usuario, activo FROM usuarios WHERE id = $1 LIMIT 1',
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
      SELECT id, usuario, nombre, apellido, tipo_usuario, primer_login, activo, created_at
      FROM usuarios
    `;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(usuario ILIKE $${params.length} OR nombre ILIKE $${params.length} OR apellido ILIKE $${params.length})`
      );
    }

    if (tipo_usuario) {
      const normalizedTipo = String(tipo_usuario).trim().toLowerCase();
      if (!ALLOWED_TYPES.has(normalizedTipo)) {
        throw createHttpError(400, 'Filtro tipo_usuario inválido');
      }
      params.push(normalizedTipo);
      conditions.push(`tipo_usuario = $${params.length}`);
    }

    if (activo === 'pendiente' || activo === 'pending') {
      conditions.push('primer_login = TRUE');
    } else if (activo === 'true') {
      params.push(true);
      conditions.push(`activo = $${params.length} AND primer_login = FALSE`);
    } else if (activo === 'false') {
      params.push(activo === 'true');
      conditions.push(`activo = $${params.length}`);
    } else if (activo !== undefined) {
      throw createHttpError(400, 'Filtro activo inválido. Usa true, false o pendiente');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY apellido ASC, nombre ASC, usuario ASC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener usuarios:');
  }
};

const createUsuario = async (req, res) => {
  try {
    const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '';
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const apellido = typeof req.body?.apellido === 'string' ? req.body.apellido.trim() : '';
    const tipoUsuario =
      typeof req.body?.tipo_usuario === 'string' ? req.body.tipo_usuario.trim().toLowerCase() : '';

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

    const result = await db.query(
      `INSERT INTO usuarios (usuario, password_hash, nombre, apellido, tipo_usuario, primer_login, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       RETURNING id, usuario, nombre, apellido, tipo_usuario, primer_login, activo`,
      [usuario, password_hash, nombre, apellido, tipoUsuario]
    );

    await logAudit(db, {
      tabla: 'usuarios',
      operacion: 'INSERT',
      registro_id: String(result.rows[0].id),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: { ...result.rows[0], temp_password: tempPassword },
    });
  } catch (error) {
    if (error.code === '23505') {
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

  return { updates, values, tipoUsuario, activo };
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

    const { updates, values, tipoUsuario, activo } = buildUpdateFields(req.body, req.user?.id, id);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    const nextTipo = tipoUsuario || currentUser.tipo_usuario;
    const nextActivo = typeof activo === 'boolean' ? activo : currentUser.activo;
    await assertGerenteNotLastActive(currentUser, nextTipo, nextActivo);

    values.push(id);
    const result = await db.query(
      `UPDATE usuarios SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, usuario, nombre, apellido, tipo_usuario, primer_login, activo`,
      values
    );

    await logAudit(db, {
      tabla: 'usuarios',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: currentUser,
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    clearActiveCache(id);
    res.json({ success: true, message: 'Usuario actualizado exitosamente', data: result.rows[0] });
  } catch (error) {
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

    const userToDelete = await getUsuarioSummaryById(id);
    if (!userToDelete) {
      throw createHttpError(404, 'Usuario no encontrado');
    }

    if (userToDelete.tipo_usuario === ROLE_GERENTE && userToDelete.activo) {
      const activeGerentesCount = await getActiveGerentesCount();
      if (activeGerentesCount <= 1) {
        throw createHttpError(400, 'Debe existir al menos un gerente activo en el sistema');
      }
    }

    const result = await db.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      throw createHttpError(404, 'Usuario no encontrado');
    }

    await logAudit(db, {
      tabla: 'usuarios',
      operacion: 'DELETE',
      registro_id: String(id),
      datos_anteriores: userToDelete,
      ...auditFromReq(req),
    });

    clearActiveCache(id);
    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar usuario:');
  }
};

module.exports = { getUsuarios, createUsuario, updateUsuario, reenviarInvitacion, deleteUsuario };
