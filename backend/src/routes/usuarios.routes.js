const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');
const { validateRequest } = require('../middleware/validation');
const { usuarioCreateSchema, usuarioUpdateSchema } = require('../utils/validationSchemas');

router.use(verifyToken);

// Listado
router.get('/', requirePermission(PERMISSIONS.USUARIOS_VER), usuariosController.getUsuarios);
router.get(
  '/colaboradores-elegibles',
  requirePermission(PERMISSIONS.USUARIOS_VER),
  usuariosController.getColaboradoresElegibles
);
router.get(
  '/ubicaciones-asignables',
  requirePermission(PERMISSIONS.BITACORAS_ASIGNACIONES_ADMINISTRAR),
  usuariosController.getUbicacionesAsignables
);

// Crear usuario
router.post(
  '/',
  requirePermission(PERMISSIONS.USUARIOS_CREAR),
  validateRequest(usuarioCreateSchema),
  usuariosController.createUsuario
);

// Actualizar usuario (tipo/activo)
router.put(
  '/:id',
  requirePermission(PERMISSIONS.USUARIOS_EDITAR),
  validateRequest(usuarioUpdateSchema),
  usuariosController.updateUsuario
);

// Regenerar invitación para usuarios pendientes
router.post(
  '/:id/invitacion',
  requirePermission(PERMISSIONS.USUARIOS_EDITAR),
  usuariosController.reenviarInvitacion
);

// Eliminar usuario
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USUARIOS_ELIMINAR),
  usuariosController.deleteUsuario
);

module.exports = router;
