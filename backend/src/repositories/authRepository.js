const db = require('../config/database');

const schemaCache = {};

const tableColumnExists = async (tableName, columnName) => {
  const key = `${tableName}.${columnName}`;
  if (key in schemaCache) {
    return schemaCache[key];
  }

  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  schemaCache[key] = result.rowCount > 0;
  return schemaCache[key];
};

const getUserIdentitySelect = async () => {
  const [hasNombre, hasApellido] = await Promise.all([
    tableColumnExists('usuarios', 'nombre'),
    tableColumnExists('usuarios', 'apellido'),
  ]);

  return {
    nombre: hasNombre ? 'nombre' : 'NULL::varchar AS nombre',
    apellido: hasApellido ? 'apellido' : 'NULL::varchar AS apellido',
  };
};

const findUserForLogin = async (usuario) => {
  const identitySelect = await getUserIdentitySelect();
  const result = await db.query(
    `SELECT id, usuario, ${identitySelect.nombre}, ${identitySelect.apellido}, tipo_usuario, primer_login, activo, password_hash FROM usuarios WHERE usuario = $1`,
    [usuario]
  );
  return result.rows[0] || null;
};

const findUserForSession = async (userId) => {
  const identitySelect = await getUserIdentitySelect();
  const result = await db.query(
    `SELECT id, usuario, ${identitySelect.nombre}, ${identitySelect.apellido}, tipo_usuario, primer_login, activo FROM usuarios WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

const findPasswordHashByUserId = async (userId) => {
  const result = await db.query('SELECT password_hash FROM usuarios WHERE id = $1', [userId]);
  return result.rows[0]?.password_hash || null;
};

const updatePasswordAndClearFirstLogin = async (userId, passwordHash) => {
  const result = await db.query(
    'UPDATE usuarios SET password_hash = $1, primer_login = FALSE WHERE id = $2 RETURNING id',
    [passwordHash, userId]
  );
  return result.rowCount > 0;
};

module.exports = {
  findPasswordHashByUserId,
  findUserForLogin,
  findUserForSession,
  updatePasswordAndClearFirstLogin,
};
