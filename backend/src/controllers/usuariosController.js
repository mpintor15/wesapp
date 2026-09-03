const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const db = require('../config/database');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { clearActiveCache } = require('../middleware/permissions');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { logAudit, auditFromReq } = require('../utils/audit');
const { assertUsuarioWithoutActivity } = require('../services/usuariosDeletionService');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');

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
const ROLE_GUARDIA = 'guardia';

const normalizeUbicacionIds = (value) => [...new Set((value || []).map(Number))];

const assertCanManageAssignments = (req) => {
  if (!hasPermission(req.user?.tipo_usuario, PERMISSIONS.BITACORAS_ASIGNACIONES_ADMINISTRAR)) {
    throw createHttpError(403, 'No tienes permiso para administrar asignaciones');
  }
};

const replaceAssignments = async (client, usuarioId, tipoUsuario, ubicacionIds, createdBy) => {
  const ids = normalizeUbicacionIds(ubicacionIds);
  if (tipoUsuario !== ROLE_GUARDIA && ids.length > 0) {
    throw createHttpError(400, 'Solo los usuarios Guardia pueden tener puntos asignados');
  }
  if (ids.length > 0) {
    const locations = await client.query('SELECT id FROM ubicaciones WHERE id = ANY($1::int[])', [
      ids,
    ]);
    if (locations.rowCount !== ids.length) {
      throw createHttpError(400, 'Una o más ubicaciones no existen');
    }
  }
  await client.query('DELETE FROM usuario_ubicaciones WHERE usuario_id = $1', [usuarioId]);
  for (const ubicacionId of ids) {
    await client.query(
      'INSERT INTO usuario_ubicaciones (usuario_id, ubicacion_id, created_by) VALUES ($1, $2, $3)',
      [usuarioId, ubicacionId, createdBy || null]
    );
  }
  return ids;
};

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
    const pagination = normalizePaginationQuery(req.query);
    let query = `
      SELECT u.id, u.usuario, u.nombre, u.apellido, u.tipo_usuario, u.primer_login, u.activo,
             u.created_at, u.colaborador_id, c.nombres_completos AS colaborador_nombre,
             c.estado AS colaborador_estado,
             COALESCE(ARRAY_AGG(uu.ubicacion_id) FILTER (WHERE uu.ubicacion_id IS NOT NULL), '{}') AS ubicacion_ids
      FROM usuarios u
      LEFT JOIN colaboradores c ON c.id = u.colaborador_id
      LEFT JOIN usuario_ubicaciones uu ON uu.usuario_id = u.id
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
    query += ' GROUP BY u.id, c.nombres_completos, c.estado';

    params.push(pagination.pageSize, pagination.offset);
    query = `SELECT filtered.*, COUNT(*) OVER()::int AS total_count
      FROM (${query}) filtered
      ORDER BY filtered.apellido ASC, filtered.nombre ASC, filtered.usuario ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);
    const totalItems = Number(result.rows[0]?.total_count || 0);
    const data = result.rows.map(({ total_count: _totalCount, ...usuario }) => usuario);
    res.json({
      success: true,
      data,
      pagination: buildPaginationMetadata({
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems,
      }),
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener usuarios:');
  }
};

const getUbicacionesAsignables = async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.nombre, c.direccion, u.cliente_id, c.nombre AS cliente_nombre
       FROM ubicaciones u LEFT JOIN clientes c ON c.id = u.cliente_id
       ORDER BY COALESCE(c.nombre, ''), u.nombre`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener ubicaciones asignables:');
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
    throw createHttpError(400, 'El colaborador es requerido');
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
    const colaboradorId = req.body?.colaborador_id;
    const hasAssignments = Object.prototype.hasOwnProperty.call(req.body || {}, 'ubicacion_ids');
    const ubicacionIds = req.body?.ubicacion_ids || [];

    if (!usuario || !tipoUsuario || !nombre || !apellido || !colaboradorId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario, nombre, apellido, tipo de usuario y colaborador son requeridos',
      });
    }

    if (!ALLOWED_TYPES.has(tipoUsuario)) {
      return res.status(400).json({ success: false, message: 'Tipo de usuario inválido' });
    }
    if (hasAssignments) {
      assertCanManageAssignments(req);
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
      if (hasAssignments) {
        createdUsuario.ubicacion_ids = await replaceAssignments(
          client,
          createdUsuario.id,
          tipoUsuario,
          ubicacionIds,
          req.user?.id
        );
      }
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
    if (colaboradorId === null || colaboradorId === undefined) {
      throw createHttpError(400, 'El colaborador es requerido');
    }
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
    const hasAssignments = Object.prototype.hasOwnProperty.call(req.body || {}, 'ubicacion_ids');
    const ubicacionIds = req.body?.ubicacion_ids || [];
    if (hasAssignments) {
      assertCanManageAssignments(req);
    }

    if (updates.length === 0 && !hasAssignments) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    if (currentUser.colaborador_id === null && !hasColaboradorId) {
      throw createHttpError(400, 'El colaborador es requerido para editar este usuario');
    }

    const nextTipo = tipoUsuario || currentUser.tipo_usuario;
    const nextActivo = typeof activo === 'boolean' ? activo : currentUser.activo;
    if (currentUser.tipo_usuario === ROLE_GUARDIA && nextTipo !== ROLE_GUARDIA) {
      assertCanManageAssignments(req);
    }
    await assertGerenteNotLastActive(currentUser, nextTipo, nextActivo);

    let updatedUsuario;
    await db.transaction(async (client) => {
      if (hasColaboradorId && colaboradorId !== currentUser.colaborador_id) {
        await assertEligibleColaborador(client, colaboradorId, id);
      }
      let result;
      if (updates.length > 0) {
        values.push(id);
        result = await client.query(
          `UPDATE usuarios SET ${updates.join(', ')}
           WHERE id = $${values.length}
           RETURNING id, usuario, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo`,
          values
        );
      } else {
        result = await client.query(
          `SELECT id, usuario, nombre, apellido, tipo_usuario, colaborador_id, primer_login, activo
           FROM usuarios WHERE id = $1`,
          [id]
        );
      }
      updatedUsuario = result.rows[0];
      if (hasAssignments || nextTipo !== ROLE_GUARDIA) {
        updatedUsuario.ubicacion_ids = await replaceAssignments(
          client,
          id,
          nextTipo,
          hasAssignments ? ubicacionIds : [],
          req.user?.id
        );
      }
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
  getUbicacionesAsignables,
  createUsuario,
  updateUsuario,
  reenviarInvitacion,
  deleteUsuario,
};
