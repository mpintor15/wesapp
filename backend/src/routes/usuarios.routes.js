const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middleware/auth');
const { requireActive, requirePermission } = require('../middleware/permissions');

router.use(verifyToken, requireActive, requirePermission('usuarios'));

// Listado
router.get('/', usuariosController.getUsuarios);

// Crear usuario
router.post('/', usuariosController.createUsuario);

// Actualizar usuario (tipo/activo)
router.put('/:id', usuariosController.updateUsuario);

// Eliminar usuario
router.delete('/:id', usuariosController.deleteUsuario);

module.exports = router;
