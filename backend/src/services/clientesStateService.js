const CLIENT_INACTIVE_MESSAGE = 'El cliente está inactivo y no puede usarse en nuevas operaciones.';

const createStateError = (status, appCode, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.appCode = appCode;
  error.code = appCode;
  return error;
};

const createClientNotFoundError = () =>
  createStateError(404, 'CLIENT_NOT_FOUND', 'Cliente no encontrado');

const createClientInactiveError = () =>
  createStateError(409, 'CLIENT_INACTIVE', CLIENT_INACTIVE_MESSAGE);

const findClienteEstadoForOperation = (executor, clienteId, lockClause = 'FOR SHARE') =>
  executor.query(
    `SELECT id, nombre, identificacion, estado
     FROM clientes
     WHERE id = $1
     ${lockClause}`,
    [clienteId]
  );

const assertClienteActivoForOperation = async ({
  executor,
  clienteId,
  lockClause = 'FOR SHARE',
}) => {
  const result = await findClienteEstadoForOperation(executor, clienteId, lockClause);

  if (result.rowCount === 0) {
    throw createClientNotFoundError();
  }

  if (result.rows[0].estado !== 'activo') {
    throw createClientInactiveError();
  }

  return result.rows[0];
};

module.exports = {
  CLIENT_INACTIVE_MESSAGE,
  assertClienteActivoForOperation,
  createClientInactiveError,
  createClientNotFoundError,
};
