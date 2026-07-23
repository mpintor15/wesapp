const CLIENT_HAS_RELATIONS_CODE = 'CLIENT_HAS_RELATIONS';
const CLIENT_NOT_FOUND_CODE = 'CLIENT_NOT_FOUND';
const CLIENT_HAS_RELATIONS_MESSAGE =
  'El cliente tiene información relacionada y no puede eliminarse. Desactívalo para conservar el historial.';
const CLIENT_NOT_FOUND_MESSAGE = 'Cliente no encontrado';

const createDeletionError = (status, code, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.appCode = code;
  if (details) {
    error.details = details;
  }
  return error;
};

const createClientHasRelationsError = (details) =>
  createDeletionError(409, CLIENT_HAS_RELATIONS_CODE, CLIENT_HAS_RELATIONS_MESSAGE, details);

const createClientNotFoundError = () =>
  createDeletionError(404, CLIENT_NOT_FOUND_CODE, CLIENT_NOT_FOUND_MESSAGE);

const normalizeCount = (value) => Number.parseInt(value, 10) || 0;

const hasRelations = (counts) => counts.ubicaciones > 0 || counts.facturas > 0 || counts.pagos > 0;

const getClienteRelationCounts = async (executor, clienteId) => {
  const result = await executor.query(
    `SELECT
       (SELECT COUNT(*)::int FROM ubicaciones WHERE cliente_id = $1) AS ubicaciones,
       (SELECT COUNT(*)::int FROM cuentas WHERE cliente_id = $1) AS facturas,
       (SELECT COUNT(*)::int FROM pagos WHERE cliente_id = $1) AS pagos`,
    [clienteId]
  );
  const counts = result.rows[0] || {};
  return {
    ubicaciones: normalizeCount(counts.ubicaciones),
    facturas: normalizeCount(counts.facturas),
    pagos: normalizeCount(counts.pagos),
  };
};

const deleteClienteWithoutRelations = async ({ executor, clienteId, audit }) => {
  const current = await executor.query(
    `SELECT id, nombre, identificacion, tipo_identificacion, telefono, correo,
            direccion, ciudad, estado
     FROM clientes
     WHERE id = $1
     FOR UPDATE`,
    [clienteId]
  );

  if (current.rowCount === 0) {
    throw createClientNotFoundError();
  }

  const relationCounts = await getClienteRelationCounts(executor, clienteId);
  if (hasRelations(relationCounts)) {
    throw createClientHasRelationsError(relationCounts);
  }

  try {
    const deleted = await executor.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [
      clienteId,
    ]);
    if (deleted.rowCount !== 1) {
      throw createClientNotFoundError();
    }
  } catch (error) {
    if (error?.code === '23503') {
      throw createClientHasRelationsError(relationCounts);
    }
    throw error;
  }

  if (audit) {
    await audit(current.rows[0]);
  }

  return current.rows[0];
};

module.exports = {
  CLIENT_HAS_RELATIONS_CODE,
  CLIENT_HAS_RELATIONS_MESSAGE,
  CLIENT_NOT_FOUND_CODE,
  CLIENT_NOT_FOUND_MESSAGE,
  createClientHasRelationsError,
  deleteClienteWithoutRelations,
  getClienteRelationCounts,
};
