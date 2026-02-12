const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/config');

/**
 * Login de usuario
 */
const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    // Validar datos
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }
    
    // Buscar usuario en la base de datos
    const result = await db.query(
      'SELECT * FROM usuarios WHERE usuario = $1',
      [usuario]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }
    
    const user = result.rows[0];
    
    // Verificar si el usuario está activo
    if (!user.activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado. Contacta al administrador'
      });
    }
    
    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        tipo_usuario: user.tipo_usuario
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiration }
    );
    
    // Responder con token y datos del usuario
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id: user.id,
          usuario: user.usuario,
          tipo_usuario: user.tipo_usuario,
          primer_login: user.primer_login
        }
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

/**
 * Cambiar contraseña
 */
const changePassword = async (req, res) => {
  try {
    const { nueva_password, confirmar_password } = req.body;
    const userId = req.user.id;
    
    // Validar datos
    if (!nueva_password || !confirmar_password) {
      return res.status(400).json({
        success: false,
        message: 'Ambas contraseñas son requeridas'
      });
    }
    
    // Verificar que las contraseñas coincidan
    if (nueva_password !== confirmar_password) {
      return res.status(400).json({
        success: false,
        message: 'Las contraseñas no coinciden'
      });
    }
    
    // Validar longitud mínima
    if (nueva_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }
    
    // Hashear nueva contraseña
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(nueva_password, saltRounds);
    
    // Actualizar contraseña y marcar primer_login como false
    await db.query(
      'UPDATE usuarios SET password_hash = $1, primer_login = FALSE WHERE id = $2',
      [password_hash, userId]
    );
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

/**
 * Verificar token
 */
const verifyToken = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener datos actualizados del usuario
    const result = await db.query(
      'SELECT id, usuario, tipo_usuario, primer_login, activo FROM usuarios WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const user = result.rows[0];
    
    if (!user.activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          usuario: user.usuario,
          tipo_usuario: user.tipo_usuario,
          primer_login: user.primer_login
        }
      }
    });
    
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

module.exports = {
  login,
  changePassword,
  verifyToken
};