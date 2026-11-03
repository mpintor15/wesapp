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
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { createHttpError, handleControllerError } = require('../utils/http');
const { sendAuthenticationRequired, sendUserDisabled } = require('../utils/authErrorCodes');
const authRepository = require('../repositories/authRepository');
const logger = require('../config/logger');
const { sanitizeError } = require('../utils/logSanitizer');
const {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} = require('../utils/sessionCookie');

const BCRYPT_ROUNDS = 10;
// Hash falso para gastar el mismo tiempo de bcrypt cuando el usuario no existe o está
// bloqueado, de modo que la latencia no delate qué usuarios existen.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomUUID(), BCRYPT_ROUNDS);

const signSessionToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      usuario: user.usuario,
      tipo_usuario: user.tipo_usuario,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiration,
      algorithm: config.jwt.algorithm,
      jwtid: crypto.randomUUID(),
    }
  );

const extractRawToken = (req) => {
  const [scheme, bearerToken] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && bearerToken) {
    return bearerToken;
  }
  return readSessionToken(req);
};

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

    // Todas las fallas previas a validar la contraseña (usuario inexistente o
    // cuenta bloqueada) responden igual que una contraseña errónea y tardan lo mismo.
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return sendAuthenticationRequired(res);
    }

    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return sendAuthenticationRequired(res);
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      await authRepository.registerFailedLogin(user.id, config.loginLockout);
      return sendAuthenticationRequired(res);
    }

    // Solo quien demuestra conocer la contraseña se entera de que está desactivado.
    if (!user.activo) {
      return sendUserDisabled(res);
    }

    await authRepository.resetFailedLogins(user.id);

    const token = signSessionToken(user);

    // La sesión del navegador viaja en una cookie HttpOnly. El token también se
    // devuelve en el cuerpo para clientes no-navegador (scripts, pruebas e2e).
    setSessionCookie(res, token);
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
 * Logout: elimina la cookie de sesión
 */
const logout = async (req, res) => {
  // Revoca el token para que no siga sirviendo si ya fue copiado (cookie o Bearer).
  // Un token ausente, inválido o vencido no necesita revocación.
  try {
    const rawToken = extractRawToken(req);
    if (rawToken) {
      const decoded = jwt.verify(rawToken, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
      });
      if (decoded.jti && Number.isInteger(Number(decoded.id)) && decoded.exp) {
        await authRepository.revokeSession({
          jti: decoded.jti,
          userId: Number(decoded.id),
          expiresAt: new Date(decoded.exp * 1000),
        });
      }
    }
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) {
      logger.warn('No se pudo revocar la sesión al cerrar sesión', sanitizeError(error));
    }
  }

  clearSessionCookie(res);
  res.json({ success: true, message: 'Sesión cerrada' });
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
    const password_hash = await bcrypt.hash(nuevaPassword, BCRYPT_ROUNDS);

    // Actualizar contraseña, marcar primer_login como false e invalidar las demás
    // sesiones. La marca usa el reloj de la app (igual que el iat del nuevo token).
    const updated = await authRepository.updatePasswordAndClearFirstLogin(
      userId,
      password_hash,
      new Date()
    );

    if (!updated) {
      throw createHttpError(404, 'Usuario no encontrado');
    }

    // La sesión actual quedó invalidada junto con las demás: se emite una nueva.
    const token = signSessionToken(req.user);
    setSessionCookie(res, token);
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
      data: { token },
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
  logout,
  changePassword,
  verifyToken,
};
