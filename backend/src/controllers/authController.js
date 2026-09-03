/**
 * authController.js — Controlador de autenticación
 *
 * Funciones:
 *  - login         : Recibe usuario y contraseña, verifica contra la base de
 *                    datos con bcrypt y, si son correctos, genera un JWT firmado
 *                    que incluye id, usuario y tipo_usuario. Bloquea usuarios inactivos.
 *  - changePassword: Permite a un usuario autenticado cambiar su contraseña.
 *                    Valida coincidencia y longitud mínima, hashea con bcrypt
 *                    y marca primer_login = FALSE para no forzar el cambio de nuevo.
 *  - verifyToken   : Refresca los datos del usuario a partir del JWT activo;
 *                    utilizado al recargar la app para restaurar la sesión.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { createHttpError, handleControllerError } = require('../utils/http');
const { sendAuthenticationRequired, sendUserDisabled } = require('../utils/authErrorCodes');
const authRepository = require('../repositories/authRepository');

/**
 * Login de usuario
 */
const login = async (req, res) => {
  try {
    const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    // Validar datos
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos',
      });
    }

    const user = await authRepository.findUserForLogin(usuario);

    if (!user) {
      return sendAuthenticationRequired(res);
    }

    // Verificar si el usuario está activo
    if (!user.activo) {
      return sendUserDisabled(res);
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return sendAuthenticationRequired(res);
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        tipo_usuario: user.tipo_usuario,
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
          nombre: user.nombre,
          apellido: user.apellido,
          tipo_usuario: user.tipo_usuario,
          primer_login: user.primer_login,
          colaborador_id: user.colaborador_id,
        },
      },
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error en login:');
  }
};

/**
 * Cambiar contraseña
 */
const changePassword = async (req, res) => {
  try {
    const nuevaPassword =
      typeof req.body?.nueva_password === 'string' ? req.body.nueva_password : '';
    const confirmarPassword =
      typeof req.body?.confirmar_password === 'string' ? req.body.confirmar_password : '';
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendAuthenticationRequired(res);
    }

    // Validar datos
    if (!nuevaPassword || !confirmarPassword) {
      return res.status(400).json({
        success: false,
        message: 'Ambas contraseñas son requeridas',
      });
    }

    // Verificar que las contraseñas coincidan
    if (nuevaPassword !== confirmarPassword) {
      return res.status(400).json({
        success: false,
        message: 'Las contraseñas no coinciden',
      });
    }

    // Validar longitud mínima
    if (nuevaPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres',
      });
    }

    const currentPasswordHash = await authRepository.findPasswordHashByUserId(userId);

    if (!currentPasswordHash) {
      throw createHttpError(404, 'Usuario no encontrado');
    }

    const isSamePassword = await bcrypt.compare(nuevaPassword, currentPasswordHash);
    if (isSamePassword) {
      throw createHttpError(400, 'La nueva contraseña debe ser diferente a la actual');
    }

    // Hashear nueva contraseña
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(nuevaPassword, saltRounds);

    // Actualizar contraseña y marcar primer_login como false
    const updated = await authRepository.updatePasswordAndClearFirstLogin(userId, password_hash);

    if (!updated) {
      throw createHttpError(404, 'Usuario no encontrado');
    }

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al cambiar contraseña:');
  }
};

/**
 * Verificar token
 */
const verifyToken = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendAuthenticationRequired(res);
    }

    const user = await authRepository.findUserForSession(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    if (!user.activo) {
      return sendUserDisabled(res);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          usuario: user.usuario,
          nombre: user.nombre,
          apellido: user.apellido,
          tipo_usuario: user.tipo_usuario,
          primer_login: user.primer_login,
          colaborador_id: user.colaborador_id,
        },
      },
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al verificar token:');
  }
};

module.exports = {
  login,
  changePassword,
  verifyToken,
};
