const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { requireActive } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { loginSchema, changePasswordSchema } = require('../utils/validationSchemas');
const config = require('../config/config');

const loginLimiter = rateLimit({
  windowMs: config.rateLimits.login.windowMs,
  max: config.rateLimits.login.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de login. Intenta nuevamente en unos minutos.',
    });
  },
});

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', loginLimiter, validateRequest(loginSchema), authController.login);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña (obligatorio en primer login)
 * @access  Private
 */
router.post(
  '/change-password',
  verifyToken,
  requireActive,
  validateRequest(changePasswordSchema),
  authController.changePassword
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token y obtener datos del usuario
 * @access  Private
 */
router.get('/verify', verifyToken, authController.verifyToken);

module.exports = router;
