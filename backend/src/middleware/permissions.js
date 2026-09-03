const { hasPermission } = require('../config/permissions');
const {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  sendAuthenticationRequired,
  sendInsufficientPermissions,
  sendUserDisabled,
} = require('../utils/authErrorCodes');

const normalizePermissionList = (permissions) => {
  const rawPermissions =
    permissions.length === 1 && Array.isArray(permissions[0]) ? permissions[0] : permissions;

  return rawPermissions.filter((permission) => typeof permission === 'string' && permission.trim());
};

const buildAuthorizationError = (result) => {
  const error = new Error(result.message);
  error.status = result.status;
  error.statusCode = result.status;
  error.appCode = result.code;
  return error;
};

const evaluateAnyPermission = (user, permissions) => {
  if (!user?.id) {
    return {
      allowed: false,
      status: 401,
      code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED],
    };
  }

  if (!user.activo) {
    return {
      allowed: false,
      status: 403,
      code: AUTH_ERROR_CODES.USER_DISABLED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_DISABLED],
    };
  }

  const requestedPermissions = normalizePermissionList(permissions);

  if (!user.tipo_usuario) {
    return {
      allowed: false,
      status: 403,
      code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS],
    };
  }

  if (requestedPermissions.some((permission) => hasPermission(user.tipo_usuario, permission))) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 403,
    code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS],
  };
};

/**
 * Middleware para verificar si el usuario actual tiene permiso para una acción.
 */
const requireAllowedPermission = (permissions) => {
  return (req, res, next) => {
    const result = evaluateAnyPermission(req.user, permissions);
    if (result.allowed) {
      next();
    } else if (result.code === AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED) {
      return sendAuthenticationRequired(res);
    } else if (result.code === AUTH_ERROR_CODES.USER_DISABLED) {
      return sendUserDisabled(res);
    } else {
      return sendInsufficientPermissions(res);
    }
  };
};

const requirePermission = (permission) => requireAllowedPermission([permission]);

const requireAnyPermission = (...permissions) => requireAllowedPermission(permissions);

const assertPermission = (user, permission) => {
  const result = evaluateAnyPermission(user, [permission]);
  if (result.allowed) {
    return;
  }

  throw buildAuthorizationError(result);
};

const assertAnyPermission = (user, ...permissions) => {
  const result = evaluateAnyPermission(user, permissions);
  if (result.allowed) {
    return;
  }

  throw buildAuthorizationError(result);
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

module.exports = {
  requirePermission,
  requireAnyPermission,
  assertPermission,
  assertAnyPermission,
  requireRole,
  requireActive,
  clearActiveCache,
};
