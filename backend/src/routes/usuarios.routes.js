const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middleware/auth');
const { requireActive, requirePermission } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { usuarioCreateSchema, usuarioUpdateSchema } = require('../utils/validationSchemas');

router.use(verifyToken, requireActive, requirePermission('usuarios'));

// Listado
router.get('/', usuariosController.getUsuarios);

// Crear usuario
router.post('/', validateRequest(usuarioCreateSchema), usuariosController.createUsuario);

// Actualizar usuario (tipo/activo)
router.put('/:id', validateRequest(usuarioUpdateSchema), usuariosController.updateUsuario);

// Regenerar invitación para usuarios pendientes
router.post('/:id/invitacion', usuariosController.reenviarInvitacion);

// Eliminar usuario
router.delete('/:id', usuariosController.deleteUsuario);

module.exports = router;
