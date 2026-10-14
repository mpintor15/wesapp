const AUTH_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  USER_DISABLED: 'USER_DISABLED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
};

const AUTH_ERROR_MESSAGES = {
  [AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED]: 'La sesión no es válida o ha expirado.',
  [AUTH_ERROR_CODES.USER_DISABLED]: 'El usuario está desactivado.',
  [AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'No tiene permisos para realizar esta acción.',
  [AUTH_ERROR_CODES.PASSWORD_CHANGE_REQUIRED]:
    'Debe cambiar su contraseña temporal antes de continuar.',
};

const sendAuthError = (res, status, code) =>
  res.status(status).json({
    success: false,
    code,
    message: AUTH_ERROR_MESSAGES[code],
  });

const sendAuthenticationRequired = (res) =>
  sendAuthError(res, 401, AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED);

const sendUserDisabled = (res) => sendAuthError(res, 403, AUTH_ERROR_CODES.USER_DISABLED);

const sendInsufficientPermissions = (res) =>
  sendAuthError(res, 403, AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);

const sendPasswordChangeRequired = (res) =>
  sendAuthError(res, 403, AUTH_ERROR_CODES.PASSWORD_CHANGE_REQUIRED);

module.exports = {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  sendAuthenticationRequired,
  sendUserDisabled,
  sendInsufficientPermissions,
  sendPasswordChangeRequired,
};
