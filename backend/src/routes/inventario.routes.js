const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const ubicacionesRoutes = require('./ubicaciones.routes');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');
const { validateRequest } = require('../middleware/validation');
const {
  articuloCreateSchema,
  articuloUpdateSchema,
  articuloBajaSchema,
  movimientoCreateSchema,
} = require('../utils/validationSchemas');

// ============================================
// UBICACIONES
// ============================================

router.use('/ubicaciones', ubicacionesRoutes);

router.use(verifyToken);

// ============================================
// ARTICULOS
// ============================================

/**
 * @route   GET /api/inventario/articulos
 * @desc    Obtener articulos con filtros
 * @access  Private (inventario)
 */
router.get(
  '/articulos',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_VER),
  inventarioController.getArticulos
);

router.get(
  '/articulos/catalogo',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_VER),
  inventarioController.getArticulosCatalogo
);

/**
 * @route   GET /api/inventario/articulos/bajas
 * @desc    Obtener historial de bajas de artículos
 * @access  Private (inventario)
 */
router.get(
  '/articulos/bajas',
  requirePermission(PERMISSIONS.INVENTARIO_BAJAS_VER),
  inventarioController.getBajasArticulos
);

/**
 * @route   POST /api/inventario/bajas/:id/anular
 * @desc    Anular una baja de artículo
 * @access  Private (gerente/supervisor)
 */
router.post(
  '/bajas/:id/anular',
  requirePermission(PERMISSIONS.INVENTARIO_BAJAS_ANULAR),
  inventarioController.anularBajaArticulo
);

/**
 * @route   DELETE /api/inventario/bajas/:id
 * @desc    Eliminar administrativamente una baja anulada
 * @access  Private (gerente)
 */
router.delete(
  '/bajas/:id',
  requirePermission(PERMISSIONS.INVENTARIO_BAJAS_ELIMINAR),
  inventarioController.deleteBajaAdministrativa
);

/**
 * @route   GET /api/inventario/articulos/bajas/excel
 * @desc    Exportar historial de bajas a Excel
 * @access  Private (exportar)
 */
router.get(
  '/articulos/bajas/excel',
  requirePermission(PERMISSIONS.INVENTARIO_REPORTES_EXPORTAR),
  inventarioController.exportBajasArticulosExcel
);

/**
 * @route   GET /api/inventario/articulos/excel
 * @desc    Exportar articulos a Excel
 * @access  Private (exportar)
 */
router.get(
  '/articulos/excel',
  requirePermission(PERMISSIONS.INVENTARIO_REPORTES_EXPORTAR),
  inventarioController.exportArticulosExcel
);

/**
 * @route   POST /api/inventario/articulos
 * @desc    Crear articulo
 * @access  Private (crear_articulo)
 */
router.post(
  '/articulos',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR),
  validateRequest(articuloCreateSchema),
  inventarioController.createArticulo
);

/**
 * @route   PUT /api/inventario/articulos/:id
 * @desc    Actualizar articulo
 * @access  Private (crear_articulo)
 */
router.put(
  '/articulos/:id',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR),
  validateRequest(articuloUpdateSchema),
  inventarioController.updateArticulo
);

/**
 * @route   POST /api/inventario/articulos/:id/baja
 * @desc    Dar de baja total o parcialmente un artículo
 * @access  Private (dar_baja_articulo)
 */
router.post(
  '/articulos/:id/baja',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_DAR_BAJA),
  validateRequest(articuloBajaSchema),
  inventarioController.darBajaArticulo
);

/**
 * @route   DELETE /api/inventario/articulos/:id
 * @desc    Eliminar articulo
 * @access  Private (gerente + eliminar_articulo)
 */
router.delete(
  '/articulos/:id',
  requirePermission(PERMISSIONS.INVENTARIO_ARTICULOS_ELIMINAR),
  inventarioController.deleteArticulo
);

// ============================================
// MOVIMIENTOS
// ============================================

/**
 * @route   GET /api/inventario/movimientos
 * @desc    Obtener movimientos
 * @access  Private (inventario)
 */
router.get(
  '/movimientos',
  requirePermission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER),
  inventarioController.getMovimientos
);

/**
 * @route   GET /api/inventario/movimientos/excel
 * @desc    Exportar movimientos a Excel
 * @access  Private (exportar)
 */
router.get(
  '/movimientos/excel',
  requirePermission(PERMISSIONS.INVENTARIO_REPORTES_EXPORTAR),
  inventarioController.exportMovimientosExcel
);

/**
 * @route   GET /api/inventario/movimientos/:id/pdf
 * @desc    Descargar PDF de movimiento
 * @access  Private (inventario)
 */
router.get(
  '/movimientos/:id/pdf',
  requirePermission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER),
  inventarioController.downloadMovimientoPdf
);

/**
 * @route   POST /api/inventario/movimientos/:id/anular
 * @desc    Anular movimiento de inventario
 * @access  Private (gerente/supervisor)
 */
router.post(
  '/movimientos/:id/anular',
  requirePermission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_ANULAR),
  inventarioController.anularMovimiento
);

/**
 * @route   DELETE /api/inventario/movimientos/:id
 * @desc    Eliminar administrativamente un movimiento anulado
 * @access  Private (gerente)
 */
router.delete(
  '/movimientos/:id',
  requirePermission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_ELIMINAR),
  inventarioController.deleteMovimientoAdministrativo
);

/**
 * @route   POST /api/inventario/movimientos/:id/pdf/regenerar
 * @desc    Regenerar PDF de movimiento
 * @access  Private (gerente)
 */
router.post(
  '/movimientos/:id/pdf/regenerar',
  requirePermission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_REGENERAR_PDF),
  inventarioController.regenerateMovimientoPdf
);

/**
 * @route   POST /api/inventario/movimientos
 * @desc    Crear movimiento
 * @access  Private (crear_movimiento)
 */
router.post(
  '/movimientos',
  requirePermission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR),
  validateRequest(movimientoCreateSchema),
  inventarioController.createMovimiento
);

module.exports = router;
