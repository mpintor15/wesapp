const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');

router.use(verifyToken);

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
