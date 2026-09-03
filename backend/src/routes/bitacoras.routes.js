const express = require('express');
const bitacorasController = require('../controllers/bitacorasController');
const { verifyToken } = require('../middleware/auth');
const { requireAnyPermission, requirePermission } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { PERMISSIONS } = require('../config/permissions');
const {
  bitacoraRegistroCreateSchema,
  bitacoraVisitCancelSchema,
  bitacoraVisitCloseSchema,
  bitacoraVisitCreateSchema,
  bitacoraVisitFormPublishSchema,
  bitacoraVisitFormArchiveSchema,
} = require('../utils/validationSchemas');

const router = express.Router();

router.use(verifyToken);

router.get(
  '/ubicaciones',
  requireAnyPermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR, PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.getUbicacionesVisibles
);

router.get(
  '/resumen',
  requireAnyPermission(
    PERMISSIONS.BITACORAS_HISTORIAL_VER,
    PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR
  ),
  bitacorasController.getResumen
);

router.get(
  '/registros',
  requirePermission(PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.getRegistros
);

router.get(
  '/registros/excel',
  requirePermission(PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.exportRegistros
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

router.get(
  '/formularios-visitas',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR),
  bitacorasController.getVisitForms
);

router.get(
  '/formularios-visitas/excel',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR),
  bitacorasController.exportVisitForms
);

router.get(
  '/formularios-visitas/:formId',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_GESTIONAR),
  bitacorasController.getVisitFormDetail
);

router.get(
  '/ubicaciones/:ubicacionId/formulario-visitas/activo',
  requireAnyPermission(
    PERMISSIONS.BITACORAS_REGISTRO_CREAR,
    PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR
  ),
  bitacorasController.getActiveVisitForm
);

router.post(
  '/ubicaciones/:ubicacionId/formulario-visitas/publicar',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR),
  validateRequest(bitacoraVisitFormPublishSchema),
  bitacorasController.publishVisitForm
);

router.post(
  '/formularios-visitas/:formId/archivar',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_GESTIONAR),
  validateRequest(bitacoraVisitFormArchiveSchema),
  bitacorasController.archiveVisitForm
);

router.post(
  '/formularios-visitas/:formId/activar',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_GESTIONAR),
  validateRequest(bitacoraVisitFormArchiveSchema),
  bitacorasController.reactivateVisitForm
);

router.delete(
  '/formularios-visitas/:formId',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_GESTIONAR),
  bitacorasController.deleteArchivedVisitForm
);

router.get(
  '/visitas',
  requirePermission(PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.getVisitas
);

router.get(
  '/visitas/excel',
  requirePermission(PERMISSIONS.BITACORAS_HISTORIAL_VER),
  bitacorasController.exportVisitas
);

router.post(
  '/visitas',
  requirePermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR),
  validateRequest(bitacoraVisitCreateSchema),
  bitacorasController.createVisita
);

router.post(
  '/visitas/:visitaId/cerrar',
  requirePermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR),
  validateRequest(bitacoraVisitCloseSchema),
  bitacorasController.closeVisita
);

router.post(
  '/visitas/:visitaId/anular',
  requirePermission(PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR),
  validateRequest(bitacoraVisitCancelSchema),
  bitacorasController.cancelVisita
);

router.post(
  '/registros',
  requirePermission(PERMISSIONS.BITACORAS_REGISTRO_CREAR),
  validateRequest(bitacoraRegistroCreateSchema),
  bitacorasController.createRegistro
);

module.exports = router;
