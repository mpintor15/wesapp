const express = require('express');
const router = express.Router();
const cuentasController = require('../controllers/cuentasController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// All routes require authentication + cuentas permission
router.use(verifyToken, requirePermission('cuentas'));

// ============================================
// CLIENTES
// ============================================

/**
 * @route   GET /api/cuentas/clientes
 * @desc    Obtener todos los clientes
 * @access  Private (cuentas)
 */
router.get('/clientes', cuentasController.getClientes);

/**
 * @route   POST /api/cuentas/clientes
 * @desc    Crear un cliente
 * @access  Private (cuentas)
 */
router.post('/clientes', cuentasController.createCliente);

/**
 * @route   DELETE /api/cuentas/clientes/:id
 * @desc    Eliminar un cliente
 * @access  Private (cuentas)
 */
router.delete('/clientes/:id', cuentasController.deleteCliente);

// ============================================
// FACTURAS
// ============================================

/**
 * @route   POST /api/cuentas/facturas
 * @desc    Crear una factura
 * @access  Private (cuentas)
 */
router.post('/facturas', cuentasController.createFactura);

/**
 * @route   DELETE /api/cuentas/facturas/:num_factura
 * @desc    Eliminar una factura (cascada a retenciones y abonos)
 * @access  Private (cuentas)
 */
router.delete('/facturas/:num_factura', cuentasController.deleteFactura);

/**
 * @route   PATCH /api/cuentas/facturas/:num_factura/cancelar
 * @desc    Cancelar una factura (mantiene histórico pero no cuenta en totales)
 * @access  Private (cuentas)
 */
router.patch('/facturas/:num_factura/cancelar', cuentasController.cancelFactura);

// ============================================
// ABONOS
// ============================================

/**
 * @route   GET /api/cuentas/abonos/:num_factura
 * @desc    Obtener abonos de una factura
 * @access  Private (cuentas)
 */
router.get('/abonos/:num_factura', cuentasController.getAbonosByFactura);

/**
 * @route   POST /api/cuentas/abonos/batch
 * @desc    Registrar múltiples abonos en una transacción (pago por cliente)
 * @access  Private (cuentas)
 */
router.post('/abonos/batch', cuentasController.createBatchAbono);

/**
 * @route   POST /api/cuentas/abonos
 * @desc    Registrar un abono
 * @access  Private (cuentas)
 */
router.post('/abonos', cuentasController.createAbono);

// ============================================
// REPORTE
// ============================================

/**
 * @route   GET /api/cuentas/reporte/excel
 * @desc    Exportar reporte a Excel
 * @access  Private (cuentas)
 */
router.get('/reporte/excel', cuentasController.exportReporteExcel);

/**
 * @route   GET /api/cuentas/reporte
 * @desc    Obtener reporte de cuentas por cobrar
 * @access  Private (cuentas)
 */
router.get('/reporte', cuentasController.getReporte);

module.exports = router;
