const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');
const clientesPortalController = require('../controllers/clientesPortalController');
const { validateRequest } = require('../middleware/validation');
const {
  clientePortalAccessCreateSchema,
  clientePortalAccessUpdateSchema,
} = require('../utils/validationSchemas');
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

// Acceso del cliente al portal de visitas: gerente, secretario y supervisor lo crean;
// solo gerente y secretario lo activan, restablecen o eliminan.
const {
  CLIENTES_ACCESO_PORTAL_CREAR: crearAcceso,
  CLIENTES_ACCESO_PORTAL_ADMINISTRAR: gestionarAcceso,
} = PERMISSIONS;
router.get(
  '/:id/acceso-portal',
  requireAnyPermission(crearAcceso, gestionarAcceso),
  clientesPortalController.getAcceso
);
router.post(
  '/:id/acceso-portal',
  requirePermission(crearAcceso),
  validateRequest(clientePortalAccessCreateSchema),
  clientesPortalController.createAcceso
);
router.patch(
  '/:id/acceso-portal',
  requirePermission(gestionarAcceso),
  validateRequest(clientePortalAccessUpdateSchema),
  clientesPortalController.updateAcceso
);
router.post(
  '/:id/acceso-portal/restablecer',
  requirePermission(gestionarAcceso),
  clientesPortalController.resetAcceso
);
router.delete(
  '/:id/acceso-portal',
  requirePermission(gestionarAcceso),
  clientesPortalController.deleteAcceso
);

module.exports = router;
