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

/**
 * Middleware para verificar token JWT
 */
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

module.exports = { verifyToken };
