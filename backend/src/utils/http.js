const logger = require('../config/logger');
const { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } = require('./authErrorCodes');
const { parseStrictPositiveInteger } = require('./inputValidation');
const { sanitizeError } = require('./logSanitizer');

const KNOWN_INPUT_OR_CONSTRAINT_CODES = new Set(['22P02', '23503', '23505', '23514']);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  return error;
};

const parsePositiveInteger = (value, message) => {
  const result = parseStrictPositiveInteger(value, message);
  if (!result.valid) {
    throw createHttpError(400, message);
  }

  return result.value;
};

const isConstraintOrInputError = (error) => {
  return KNOWN_INPUT_OR_CONSTRAINT_CODES.has(error?.code);
};

const handleControllerError = (res, error, defaultLogMessage) => {
  if (res.headersSent) {
    return undefined;
  }

  const status = error.status || error.statusCode || (isConstraintOrInputError(error) ? 400 : 500);
  const message = status >= 500 ? 'Error en el servidor' : error.message || 'Solicitud inválida';
  const level = status >= 500 ? 'error' : 'warn';
  logger[level](defaultLogMessage, {
    error: sanitizeError(error),
    status,
  });
  if (status === 401) {
    return res.status(status).json({
      success: false,
      code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED],
    });
  }

  const body = {
    success: false,
    message,
  };

  if (error.appCode) {
    body.code = error.appCode;
  }
  if (error.details) {
    body.details = error.details;
  }

  return res.status(status).json(body);
};

module.exports = {
  createHttpError,
  parsePositiveInteger,
  isConstraintOrInputError,
  handleControllerError,
};
