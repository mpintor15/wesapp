const express = require('express');
const router = express.Router();
const cuentasController = require('../controllers/cuentasController');
const { verifyToken } = require('../middleware/auth');
const { requireActive, requirePermission, requireRole } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const {
  clienteCreateSchema,
  facturaCreateSchema,
  facturaUpdateSchema,
  facturaCancelSchema,
  pagoCreateSchema,
} = require('../utils/validationSchemas');

// All routes require authentication + cuentas permission
router.use(verifyToken, requireActive, requirePermission('cuentas'));

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
 * @route   GET /api/cuentas/clientes/excel
 * @desc    Exportar clientes a Excel
 * @access  Private (cuentas)
 */
router.get('/clientes/excel', requirePermission('exportar'), cuentasController.exportClientesExcel);

/**
 * @route   POST /api/cuentas/clientes
 * @desc    Crear un cliente
 * @access  Private (cuentas)
 */
router.post('/clientes', validateRequest(clienteCreateSchema), cuentasController.createCliente);

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
 * @route   GET /api/cuentas/facturas/next-number
 * @desc    Obtener el siguiente número de factura disponible
 * @access  Private (gerente)
 */
router.get('/facturas/next-number', requireRole('gerente'), cuentasController.getNextNumFactura);

/**
 * @route   POST /api/cuentas/facturas
 * @desc    Crear una factura
 * @access  Private (gerente)
 */
router.post(
  '/facturas',
  requireRole('gerente'),
  validateRequest(facturaCreateSchema),
  cuentasController.createFactura
);

/**
 * @route   PATCH /api/cuentas/facturas/:num_factura
 * @desc    Editar una factura (gerente only)
 * @access  Private (gerente)
 */
router.patch(
  '/facturas/:num_factura',
  requireRole('gerente'),
  validateRequest(facturaUpdateSchema),
  cuentasController.updateFactura
);

/**
 * @route   DELETE /api/cuentas/facturas/:num_factura
 * @desc    Eliminar una factura (cascada a abonos)
 * @access  Private (gerente)
 */
router.delete('/facturas/:num_factura', requireRole('gerente'), cuentasController.deleteFactura);

/**
 * @route   PATCH /api/cuentas/facturas/:num_factura/cancelar
 * @desc    Cancelar una factura (mantiene histórico pero no cuenta en totales)
 * @access  Private (gerente)
 */
router.patch(
  '/facturas/:num_factura/cancelar',
  requireRole('gerente'),
  validateRequest(facturaCancelSchema),
  cuentasController.cancelFactura
);

// ============================================
// ABONOS
// ============================================

/**
 * @route   GET /api/cuentas/pagos
 * @desc    Obtener pagos con facturas asociadas
 * @access  Private (cuentas)
 */
router.get('/pagos', cuentasController.getPagos);

/**
 * @route   GET /api/cuentas/pagos/excel
 * @desc    Exportar pagos a Excel
 * @access  Private (cuentas)
 */
router.get('/pagos/excel', requirePermission('exportar'), cuentasController.exportPagosExcel);

/**
 * @route   DELETE /api/cuentas/pagos/:id
 * @desc    Eliminar un pago completo con sus abonos
 * @access  Private (gerente)
 */
router.delete('/pagos/:id', requireRole('gerente'), cuentasController.deletePago);

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
router.post('/abonos/batch', validateRequest(pagoCreateSchema), cuentasController.createBatchAbono);

/**
 * @route   DELETE /api/cuentas/abonos/:id
 * @desc    Eliminar un abono individual (gerente only)
 * @access  Private (gerente)
 */
router.delete('/abonos/:id', requireRole('gerente'), cuentasController.deleteAbono);

// ============================================
// REPORTE
// ============================================

/**
 * @route   GET /api/cuentas/reporte/excel
 * @desc    Exportar reporte a Excel
 * @access  Private (cuentas)
 */
router.get('/reporte/excel', requirePermission('exportar'), cuentasController.exportReporteExcel);

/**
 * @route   GET /api/cuentas/reporte
 * @desc    Obtener reporte de cuentas por cobrar
 * @access  Private (cuentas)
 */
router.get('/reporte', cuentasController.getReporte);

module.exports = router;
