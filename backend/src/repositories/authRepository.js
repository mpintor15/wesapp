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
    `SELECT id, usuario, ${identitySelect.nombre}, ${identitySelect.apellido}, tipo_usuario,
            primer_login, activo, password_hash, bloqueado_hasta,
            (SELECT c.id FROM colaboradores c WHERE c.id = usuarios.colaborador_id) AS colaborador_id
     FROM usuarios
     WHERE usuario = $1`,
    [usuario]
  );
  return result.rows[0] || null;
};

const findUserForSession = async (userId) => {
  const identitySelect = await getUserIdentitySelect();
  const result = await db.query(
    `SELECT id, usuario, ${identitySelect.nombre}, ${identitySelect.apellido}, tipo_usuario,
            primer_login, activo,
            (SELECT c.id FROM colaboradores c WHERE c.id = usuarios.colaborador_id) AS colaborador_id
     FROM usuarios
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

const findPasswordHashByUserId = async (userId) => {
  const result = await db.query('SELECT password_hash FROM usuarios WHERE id = $1', [userId]);
  return result.rows[0]?.password_hash || null;
};

// sessionsValidFrom invalida todos los tokens emitidos antes de ese instante.
const updatePasswordAndClearFirstLogin = async (userId, passwordHash, sessionsValidFrom) => {
  const result = await db.query(
    `UPDATE usuarios
     SET password_hash = $1, primer_login = FALSE, intentos_fallidos = 0, bloqueado_hasta = NULL,
         sesiones_validas_desde = $3
     WHERE id = $2
     RETURNING id`,
    [passwordHash, userId, sessionsValidFrom]
  );
  return result.rowCount > 0;
};

// Revoca un token individual (cierre de sesión) y purga los ya vencidos.
const revokeSession = async ({ jti, userId, expiresAt }) => {
  await db.query('DELETE FROM sesiones_revocadas WHERE expira_at < NOW()');
  await db.query(
    `INSERT INTO sesiones_revocadas (jti, usuario_id, expira_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, userId, expiresAt]
  );
};

// Incrementa de forma atómica el contador y, al alcanzar el máximo, fija el bloqueo.
const registerFailedLogin = async (userId, { maxAttempts, lockMinutes }) => {
  const result = await db.query(
    `UPDATE usuarios
     SET intentos_fallidos = intentos_fallidos + 1,
         bloqueado_hasta = CASE
           WHEN intentos_fallidos + 1 >= $2 THEN NOW() + make_interval(mins => $3)
           ELSE bloqueado_hasta
         END
     WHERE id = $1
     RETURNING intentos_fallidos, bloqueado_hasta`,
    [userId, maxAttempts, lockMinutes]
  );
  return result.rows[0] || null;
};

const resetFailedLogins = async (userId) => {
  await db.query(
    `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = $1 AND (intentos_fallidos <> 0 OR bloqueado_hasta IS NOT NULL)`,
    [userId]
  );
};

module.exports = {
  revokeSession,
  registerFailedLogin,
  resetFailedLogins,
  findPasswordHashByUserId,
  findUserForLogin,
  findUserForSession,
  updatePasswordAndClearFirstLogin,
};
