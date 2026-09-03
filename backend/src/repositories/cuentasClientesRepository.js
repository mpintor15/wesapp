const db = require('../config/database');

const findAllClientes = (executor = db) =>
  executor.query(
    'SELECT id, nombre, identificacion, estado FROM clientes WHERE estado = $1 ORDER BY nombre ASC',
    ['activo']
  );

const findClientesForExport = (executor = db) =>
  executor.query('SELECT nombre, identificacion FROM clientes ORDER BY nombre ASC');

const createCliente = ({ nombre, identificacion }, executor = db) =>
  executor.query(
    'INSERT INTO clientes (nombre, identificacion) VALUES ($1, $2) RETURNING id, nombre, identificacion',
    [nombre, identificacion]
  );

const findClienteFacturasDependency = (clienteId, executor = db) =>
  executor.query('SELECT 1 FROM cuentas WHERE cliente_id = $1 LIMIT 1', [clienteId]);

const findClienteIdById = (clienteId, executor = db) =>
  executor.query('SELECT id, estado FROM clientes WHERE id = $1 LIMIT 1', [clienteId]);

const deleteClienteById = (clienteId, executor = db) =>
  executor.query('DELETE FROM clientes WHERE id = $1 RETURNING id, nombre, identificacion', [
    clienteId,
  ]);

module.exports = {
  createCliente,
  deleteClienteById,
  findAllClientes,
  findClienteFacturasDependency,
  findClienteIdById,
  findClientesForExport,
};
