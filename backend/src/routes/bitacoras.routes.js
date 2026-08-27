const express = require('express');
const bitacorasController = require('../controllers/bitacorasController');
const { verifyToken } = require('../middleware/auth');
const { requireAnyPermission, requirePermission } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { PERMISSIONS } = require('../config/permissions');
const { bitacoraRegistroCreateSchema } = require('../utils/validationSchemas');

const router = express.Router();

router.use(verifyToken);

router.get(
  '/ubicaciones',
  requireAnyPermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR, PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.getUbicacionesVisibles
);

router.get(
  '/registros',
  requirePermission(PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.getRegistros
);

router.get(
  '/ubicaciones/:ubicacionId/manzanas',
  requirePermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR),
  bitacorasController.getManzanasElegibles
);

router.get(
  '/manzanas/:manzanaId/villas',
  requirePermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR),
  bitacorasController.getVillasElegibles
);

router.post(
  '/registros',
  requirePermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR),
  validateRequest(bitacoraRegistroCreateSchema),
  bitacorasController.createRegistro
);

module.exports = router;
