/**
 * permissions.js — Middlewares de autorización basada en roles
 *
 * Exporta:
 *  - requirePermission(modulo): Verifica que el tipo de usuario en el token
 *    tenga acceso al módulo indicado según la tabla de permisos en config.js.
 *    Responde 403 si el usuario no tiene el permiso requerido.
 *  - requireActive: Consulta la base de datos para confirmar que el usuario
 *    sigue activo (no desactivado por un administrador). Responde 403 si
 *    el usuario está desactivado.
 *
 * Ambos middlewares se usan en cadena después de verifyToken en cada ruta
 * protegida: verifyToken → requireActive → requirePermission('modulo').
 */
const config = require('../config/config');
const db = require('../config/database');
const logger = require('../config/logger');

const ACTIVE_CACHE_TTL_MS = Number.parseInt(process.env.ACTIVE_USER_CACHE_TTL_MS, 10) || 30000;
const activeUserCache = new Map();

/**
 * Middleware para verificar si el usuario tiene permiso para acceder a un módulo
 */
const requirePermission = (modulo) => {
  return (req, res, next) => {
    const { tipo_usuario } = req.user;

    if (!tipo_usuario) {
      return res.status(403).json({
        success: false,
        message: 'Tipo de usuario no definido',
      });
    }

    const permisos = config.permissions[tipo_usuario];

    if (!permisos) {
      return res.status(403).json({
        success: false,
        message: 'Tipo de usuario inválido',
      });
    }

    if (permisos.includes(modulo)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. No tienes permisos para: ${modulo}`,
      });
    }
  };
};

/**
 * Middleware para verificar si el usuario está activo
 */
const requireActive = async (req, res, next) => {
  const userId = Number(req.user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    });
  }

  try {
    const cached = activeUserCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.active) {
        return res.status(403).json({
          success: false,
          message: 'Usuario desactivado. Contacta al administrador',
        });
      }
      return next();
    }

    const result = await db.query('SELECT activo FROM usuarios WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const active = Boolean(result.rows[0].activo);
    activeUserCache.set(userId, {
      active,
      expiresAt: Date.now() + ACTIVE_CACHE_TTL_MS,
    });

    if (!active) {
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado. Contacta al administrador',
      });
    }

    next();
  } catch (error) {
    logger.error('Error en requireActive:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return res.status(500).json({
      success: false,
      message: 'Error al verificar estado del usuario',
    });
  }
};

/**
 * Middleware para restringir a uno o más roles específicos.
 * Uso: requireRole('gerente') o requireRole('gerente', 'secretario')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user?.tipo_usuario || !roles.includes(req.user.tipo_usuario)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. No tienes permisos para realizar esta acción',
      });
    }
    next();
  };
};

const clearActiveCache = (userId) => {
  if (userId) {
    activeUserCache.delete(Number(userId));
    return;
  }
  activeUserCache.clear();
};

module.exports = { requirePermission, requireRole, requireActive, clearActiveCache };
