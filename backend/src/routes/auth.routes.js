const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { requireActive } = require('../middleware/permissions');
const config = require('../config/config');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 10 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de login. Intenta nuevamente en unos minutos.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña (obligatorio en primer login)
 * @access  Private
 */
router.post('/change-password', verifyToken, requireActive, authController.changePassword);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token y obtener datos del usuario
 * @access  Private
 */
router.get('/verify', verifyToken, authController.verifyToken);

module.exports = router;
