const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// All routes require authentication + inventario permission
router.use(verifyToken, requirePermission('inventario'));

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
 * @route   DELETE /api/inventario/articulos/:id
 * @desc    Eliminar articulo
 * @access  Private (eliminar_articulo)
 */
router.delete(
  '/articulos/:id',
  requirePermission('eliminar_articulo'),
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
 * @route   GET /api/inventario/movimientos/:id
 * @desc    Obtener detalles de un movimiento
 * @access  Private (inventario)
 */
router.get('/movimientos/:id', inventarioController.getMovimientoDetalles);

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
