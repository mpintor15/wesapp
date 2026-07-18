export const AUTH_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  USER_DISABLED: 'USER_DISABLED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
};

const getLegacyAuthErrorCode = (error) => {
  const status = error.response?.status;
  const message = String(error.response?.data?.message || '').toLowerCase();

  // Compatibilidad temporal con respuestas legacy.
  // Eliminar cuando todos los endpoints utilicen códigos estables.
  if (status === 401) return AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED;
  if (status === 403 && message.includes('usuario desactivado')) {
    return AUTH_ERROR_CODES.USER_DISABLED;
  }
  if (
    status === 403 &&
    (message.includes('acceso denegado') ||
      message.includes('no tienes permisos') ||
      message.includes('permisos'))
  ) {
    return AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS;
  }

  return undefined;
};

export const getAuthErrorCode = (error) =>
  error.response?.data?.code || getLegacyAuthErrorCode(error);

export const isSessionExpiredAuthError = (error) => {
  const code = getAuthErrorCode(error);
  return (
    code === AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED || code === AUTH_ERROR_CODES.USER_DISABLED
  );
};

export const isPermissionDeniedAuthError = (error) =>
  getAuthErrorCode(error) === AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS;
