/**
 * auth.js — Middleware de autenticación JWT
 *
 * Exporta:
 *  - verifyToken: Extrae el Bearer token del header Authorization,
 *    lo verifica con la clave secreta configurada y adjunta el payload
 *    decodificado a req.user para su uso en los controladores.
 *    Responde 401 si el token está ausente, expirado o es inválido.
 */
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../config/database');
const { hasCsrfHeader, isSafeMethod, readSessionToken } = require('../utils/sessionCookie');
const {
  sendAuthenticationRequired,
  sendCsrfRejected,
  sendPasswordChangeRequired,
  sendUserDisabled,
} = require('../utils/authErrorCodes');

// Con contraseña temporal (primer_login) solo se puede cambiar la contraseña
// o restaurar la sesión; el resto del API queda bloqueado en el servidor.
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(['/api/auth/change-password', '/api/auth/verify']);

/**
 * Middleware para verificar token JWT
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader) {
    const [scheme, bearerToken] = authHeader.split(' ');
    return scheme === 'Bearer' && bearerToken ? { token: bearerToken, fromCookie: false } : null;
  }

  const cookieToken = readSessionToken(req);
  return cookieToken ? { token: cookieToken, fromCookie: true } : null;
};

const verifyToken = async (req, res, next) => {
  const extracted = extractToken(req);

  if (!extracted) {
    return sendAuthenticationRequired(res);
  }

  const { token, fromCookie } = extracted;

  // Un token enviado por cookie viaja solo en el navegador: exige el header
  // anti-CSRF en peticiones que modifican estado.
  if (fromCookie && !isSafeMethod(req) && !hasCsrfHeader(req)) {
    return sendCsrfRejected(res);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret, { algorithms: [config.jwt.algorithm] });
  } catch (error) {
    void error;
    return sendAuthenticationRequired(res);
  }

  const userId = Number(decoded?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return sendAuthenticationRequired(res);
  }

  try {
    const result = await db.query(
      `SELECT id, usuario, nombre, apellido, tipo_usuario, primer_login, activo, cliente_id
       FROM usuarios
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return sendAuthenticationRequired(res);
    }

    const user = result.rows[0];
    if (!user.activo) {
      return sendUserDisabled(res);
    }

    req.user = {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      apellido: user.apellido,
      tipo_usuario: user.tipo_usuario,
      primer_login: user.primer_login,
      activo: user.activo,
      cliente_id: user.cliente_id,
    };
    if (user.primer_login && !PASSWORD_CHANGE_ALLOWED_PATHS.has(req.originalUrl.split('?')[0])) {
      return sendPasswordChangeRequired(res);
    }
    next();
  } catch (error) {
    void error;
    return res.status(500).json({
      success: false,
      message: 'Error al verificar autenticación',
    });
  }
};

module.exports = { verifyToken };
