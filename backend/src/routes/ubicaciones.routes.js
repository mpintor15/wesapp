const express = require('express');
const router = express.Router();
const ubicacionesController = require('../controllers/ubicacionesController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

router.get(
  '/',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_VER),
  ubicacionesController.getUbicaciones
);

router.post(
  '/',
 