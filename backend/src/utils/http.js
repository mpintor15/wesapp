const logger = require('../config/logger');

const KNOWN_INPUT_OR_CONSTRAINT_CODES = new Set(['22P02', '23503', '23505', '23514']);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isConstraintOrInputError = (error) => {
  return KNOWN_INPUT_OR_CONSTRAINT_CODES.has(error?.code);
};

const handleControllerError = (res, error, defaultLogMessage) => {
  const status = error.status || (isConstraintOrInputError(error) ? 400 : 500);
  const message = status >= 500 ? 'Error en el servidor' : error.message || 'Solicitud inválida';
  const level = status >= 500 ? 'error' : 'warn';
  logger[level](defaultLogMessage, {
    message: error.message,
    stack: error.stack,
    code: error.code,
    status,
  });
  return res.status(status).json({
    success: false,
    message,
  });
};

module.exports = {
  createHttpError,
  isConstraintOrInputError,
  handleControllerError,
};
