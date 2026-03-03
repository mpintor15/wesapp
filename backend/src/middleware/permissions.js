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

/**
 * Middleware para verificar si el usuario tiene permiso para acceder a un módulo
 */
const requirePermission = (modulo) => {
  return (req, res, next) => {
    const { tipo_usuario } = req.user;

    if (!tipo_usuario) {
      return res.status(403).json({
        success: false,
        message: 'Tipo de usuario no definido'
      });
    }

    const permisos = config.permissions[tipo_usuario];

    if (!permisos) {
      return res.status(403).json({
        success: false,
        message: 'Tipo de usuario inválido'
      });
    }

    if (permisos.includes(modulo)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. No tienes permisos para: ${modulo}`
      });
    }
  };
};

/**
 * Middleware para verificar si el usuario está activo
 */
const requireActive = async (req, res, next) => {
  const db = require('../config/database');

  try {
    const result = await db.query(
      'SELECT activo FROM usuarios WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!result.rows[0].activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado. Contacta al administrador'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al verificar estado del usuario'
    });
  }
};

module.exports = { requirePermission, requireActive };
