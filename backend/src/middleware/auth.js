const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Middleware para verificar token JWT
 */
const verifyToken = (req, res, next) => {
  // Obtener token del header
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado'
    });
  }
  
  try {
    // Verificar token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Agregar información del usuario al request
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

/**
 * Middleware opcional - no falla si no hay token
 */
const optionalAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
    } catch (error) {
     // No hacer nada si el token es inválido en auth opcional
    }
  }
  
  next();
};

module.exports = {
  verifyToken,
  optionalAuth
};