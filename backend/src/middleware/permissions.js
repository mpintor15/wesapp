const { hasPermission } = require('../config/permissions');
const {
  sendAuthenticationRequired,
  sendInsufficientPermissions,
  sendUserDisabled,
} = require('../utils/authErrorCodes');

/**
 * Middleware para verificar si el usuario actual tiene permiso para una acción.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    const { tipo_usuario } = req.user;

    if (!tipo_usuario) {
      return sendInsufficientPermissions(res);
    }

    if (hasPermission(tipo_usuario, permission)) {
      next();
    } else {
      return sendInsufficientPermissions(res);
    }
  };
};

/**
 * Compatibilidad temporal: verifyToken ya rehidrata y valida usuario activo desde DB.
 */
const requireActive = (req, res, next) => {
  if (!req.user?.id) {
    return sendAuthenticationRequired(res);
  }

  if (!req.user.activo) {
    return sendUserDisabled(res);
  }

  return next();
};

/**
 * Middleware para restringir a uno o más roles específicos.
 * Uso: requireRole('gerente') o requireRole('gerente', 'secretario')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user?.tipo_usuario || !roles.includes(req.user.tipo_usuario)) {
      return sendInsufficientPermissions(res);
    }
    next();
  };
};

const clearActiveCache = (userId) => {
  void userId;
};

module.exports = { requirePermission, requireRole, requireActive, clearActiveCache };
