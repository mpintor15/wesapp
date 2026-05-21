const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verifyToken } = require('../middleware/auth');
const { requireActive, requirePermission, requireRole } = require('../middleware/permissions');

// All routes require authentication + inventario permission
router.use(verifyToken, requireActive, requirePermission('inventario'));

// ============================================
// UBICACIONES
// ============================================

/**
 * @route   GET /api/inventario/ubicaciones
 * @desc    Obtener todas las ubicaciones
 * @access  Private (inventario)
 */
router.get('/ubicaciones', inventarioController.getUbicaciones);

// ============================================
// ARTICULOS
// ============================================

/**
 * @route   GET /api/inventario/articulos
 * @desc    Obtener articulos con filtros
 * @access  Private (inventario)
 */
router.get('/articulos', inventarioController.getArticulos);

/**
 * @route   GET /api/inventario/articulos/bajas
 * @desc    Obtener historial de bajas de artículos
 * @access  Private (inventario)
 */
router.get('/articulos/bajas', inventarioController.getBajasArticulos);

/**
 * @route   GET /api/inventario/articulos/bajas/excel
 * @desc    Exportar historial de bajas a Excel
 * @access  Private (exportar)
 */
router.get(
  '/articulos/bajas/excel',
  requirePermission('exportar'),
  inventarioController.exportBajasArticulosExcel
);

/**
 * @route   GET /api/inventario/articulos/excel
 * @desc    Exportar articulos a Excel
 * @access  Private (exportar)
 */
router.get(
  '/articulos/excel',
  requirePermission('exportar'),
  inventarioController.exportArticulosExcel
);

/**
 * @route   POST /api/inventario/articulos
 * @desc    Crear articulo
 * @access  Private (crear_articulo)
 */
router.post(
  '/articulos',
  requirePermission('crear_articulo'),
  inventarioController.createArticulo
);

/**
 * @route   PUT /api/inventario/articulos/:id
 * @desc    Actualizar articulo
 * @access  Private (crear_articulo)
 */
router.put(
  '/articulos/:id',
  requirePermission('crear_articulo'),
  inventarioController.updateArticulo
);

/**
 * @route   POST /api/inventario/articulos/:id/baja
 * @desc    Dar de baja total o parcialmente un artículo
 * @access  Private (dar_baja_articulo)
 */
router.post(
  '/articulos/:id/baja',
  requirePermission('dar_baja_articulo'),
  inventarioController.darBajaArticulo
);

/**
 * @route   DELETE /api/inventario/articulos/:id
 * @desc    Eliminar articulo
 * @access  Private (gerente + eliminar_articulo)
 */
router.delete(
  '/articulos/:id',
  requirePermission('eliminar_articulo'),
  requireRole('gerente'),
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
router.get('/movimientos', inventarioController.getMovimientos);

/**
 * @route   GET /api/inventario/movimientos/excel
 * @desc    Exportar movimientos a Excel
 * @access  Private (exportar)
 */
router.get(
  '/movimientos/excel',
  requirePermission('exportar'),
  inventarioController.exportMovimientosExcel
);

/**
 * @route   GET /api/inventario/movimientos/:id/pdf
 * @desc    Descargar PDF de movimiento
 * @access  Private (inventario)
 */
router.get('/movimientos/:id/pdf', inventarioController.downloadMovimientoPdf);

/**
 * @route   POST /api/inventario/movimientos
 * @desc    Crear movimiento
 * @access  Private (crear_movimiento)
 */
router.post(
  '/movimientos',
  requirePermission('crear_movimiento'),
  inventarioController.createMovimiento
);

module.exports = router;
