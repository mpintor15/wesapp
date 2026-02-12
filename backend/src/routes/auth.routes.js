const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña (obligatorio en primer login)
 * @access  Private
 */
router.post('/change-password', verifyToken, authController.changePassword);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token y obtener datos del usuario
 * @access  Private
 */
router.get('/verify', verifyToken, authController.verifyToken);

module.exports = router;