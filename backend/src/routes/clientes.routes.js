const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');
const { verifyToken } = require('../middleware/auth');
const { requireAnyPermission, requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

router.get(
  '/opciones-ubicaciones',
  requireAnyPermission(
    PERMISSIONS.CLIENTES_VER,
    PERMISSIONS.INVENTARIO_UBICACIONES_VER,
    PERMISSIONS.INVENTARIO_UBICACIONES_CREAR,
    PERMISSIONS.INVENTARIO_UBICACIONES_EDITAR
  ),
  clientesController.getClientesOpcionesUbicaciones
);

router.get('/', requirePermission(PERMISSIONS.CLIENTES_VER), clientesController.getClientes);

router.get('/:id', requirePermission(PERMISSIONS.CLIENTES_VER), clientesController.getClienteById);

router.post('/', requirePermission(PERMISSIONS.CLIENTES_CREAR), clientesController.createCliente);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.CLIENTES_EDITAR),
  clientesController.updateCliente
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.CLIENTES_ELIMINAR),
  clientesController.deleteCliente
);

module.exports = router;
