const express = require('express');
const portalController = require('../controllers/portalController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../config/permissions');

const router = express.Router();

router.use(verifyToken);
// Solo usuarios de tipo cliente: el gerente tiene todos los permisos pero no un cliente asociado.
router.use(requireRole(ROLES.CLIENTE));
router.use(requirePermission(PERMISSIONS.PORTAL_VISITAS_VER));

router.get('/ubicaciones', portalController.getUbicaciones);
router.get('/visitas', portalController.getVisitas);

module.exports = router;
