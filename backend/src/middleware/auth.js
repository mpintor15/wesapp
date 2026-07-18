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
const { sendAuthenticationRequired, sendUserDisabled } = require('../utils/authErrorCodes');

/**
 * Middleware para verificar token JWT
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return sendAuthenticationRequired(res);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
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
      `SELECT id, usuario, nombre, apellido, tipo_usuario, primer_login, activo
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
    };
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
