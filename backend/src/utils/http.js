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
  const message = status >= 500 ? 'Error en el servidor' : (error.message || 'Solicitud inválida');
  console.error(defaultLogMessage, error);
  return res.status(status).json({
    success: false,
    message
  });
};

module.exports = {
  createHttpError,
  isConstraintOrInputError,
  handleControllerError
};
