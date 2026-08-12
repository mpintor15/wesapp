const express = require('express');
const router = express.Router();
const ubicacionesController = require('../controllers/ubicacionesController');
const { verifyToken } = require('../middleware/auth');
const { requireAnyPermission, requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

router.get(
  '/agrupadas',
  requireAnyPermission(
    PERMISSIONS.INVENTARIO_UBICACIONES_VER,
    PERMISSIONS.INVENTARIO_ARTICULOS_VER,
    PERMISSIONS.INVENTARIO_ARTICULOS_CREAR,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR
  ),
  ubicacionesController.getUbicacionesAgrupadas
);

router.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.INVENTARIO_UBICACIONES_VER,
    PERMISSIONS.INVENTARIO_ARTICULOS_VER,
    PERMISSIONS.INVENTARIO_ARTICULOS_CREAR,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR
  ),
  ubicacionesController.getUbicaciones
);

router.post(
  '/',
  requirePermission(PERMISSIONS.INVENTARIO_UBICACIONES_CREAR),
  ubicacionesController.createUbicacion
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR),
  ubicacionesController.updateUbicacion
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.INVENTARIO_UBICACIONES_ELIMINAR),
  ubicacionesController.deleteUbicacion
);

module.exports = router;
