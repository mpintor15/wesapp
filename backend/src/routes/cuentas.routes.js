const express = require('express');
const router = express.Router();
const cuentasController = require('../controllers/cuentasController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');
const { validateRequest } = require('../middleware/validation');
const {
  clienteCreateSchema,
  facturaCreateSchema,
  facturaUpdateSchema,
  facturaCancelSchema,
  pagoCreateSchema,
} = require('../utils/validationSchemas');

router.use(verifyToken);

// ============================================
// CLIENTES
// ============================================

/**
 * @route   GET /api/cuentas/clientes
 * @desc    Obtener todos los clientes
 * @access  Private (cuentas)
 */
router.get(
  '/clientes',
  requirePermission(PERMISSIONS.CUENTAS_CLIENTES_VER),
  cuentasController.getClientes
);

/**
 * @route   GET /api/cuentas/clientes/excel
 * @desc    Exportar clientes a Excel
 * @access  Private (cuentas)
 */
router.get(
  '/clientes/excel',
  requirePermission(PERMISSIONS.CUENTAS_REPORTES_EXPORTAR),
  cuentasController.exportClientesExcel
);

/**
 * @route   POST /api/cuentas/clientes
 * @desc    Crear un cliente
 * @access  Private (cuentas)
 */
router.post(
  '/clientes',
  requirePermission(PERMISSIONS.CUENTAS_CLIENTES_CREAR),
  validateRequest(clienteCreateSchema),
  cuentasController.createCliente
);

/**
 * @route   DELETE /api/cuentas/clientes/:id
 * @desc    Eliminar un cliente
 * @access  Private (cuentas)
 */
router.delete(
  '/clientes/:id',
  requirePermission(PERMISSIONS.CUENTAS_CLIENTES_ELIMINAR),
  cuentasController.deleteCliente
);

// ============================================
// FACTURAS
// ============================================

/**
 * @route   GET /api/cuentas/facturas/next-number
 * @desc    Obtener el siguiente número de factura disponible
 * @access  Private (gerente)
 */
router.get(
  '/facturas/next-number',
  requirePermission(PERMISSIONS.CUENTAS_FACTURAS_CREAR),
  cuentasController.getNextNumFactura
);

router.get(
  '/facturas/catalogo',
  requirePermission(PERMISSIONS.CUENTAS_REPORTES_GENERAR),
  cuentasController.getFacturasCatalogo
);

/**
 * @route   POST /api/cuentas/facturas
 * @desc    Crear una factura
 * @access  Private (gerente)
 */
router.post(
  '/facturas',
  requirePermission(PERMISSIONS.CUENTAS_FACTURAS_CREAR),
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
  requirePermission(PERMISSIONS.CUENTAS_FACTURAS_EDITAR),
  validateRequest(facturaUpdateSchema),
  cuentasController.updateFactura
);

/**
 * @route   DELETE /api/cuentas/facturas/:num_factura
 * @desc    Eliminación física de factura deshabilitada
 * @access  Private (gerente)
 */
router.delete(
  '/facturas/:num_factura',
  requirePermission(PERMISSIONS.CUENTAS_FACTURAS_ELIMINAR),
  cuentasController.deleteFactura
);

/**
 * @route   PATCH /api/cuentas/facturas/:num_factura/cancelar
 * @desc    Cancelar una factura (mantiene histórico pero no cuenta en totales)
 * @access  Private (gerente)
 */
router.patch(
  '/facturas/:num_factura/cancelar',
  requirePermission(PERMISSIONS.CUENTAS_FACTURAS_CANCELAR),
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
router.get('/pagos', requirePermission(PERMISSIONS.CUENTAS_PAGOS_VER), cuentasController.getPagos);

/**
 * @route   GET /api/cuentas/pagos/excel
 * @desc    Exportar pagos a Excel
 * @access  Private (cuentas)
 */
router.get(
  '/pagos/excel',
  requirePermission(PERMISSIONS.CUENTAS_REPORTES_EXPORTAR),
  cuentasController.exportPagosExcel
);

/**
 * @route   DELETE /api/cuentas/pagos/:id
 * @desc    Eliminación física de pago deshabilitada
 * @access  Private (gerente)
 */
router.delete(
  '/pagos/:id',
  requirePermission(PERMISSIONS.CUENTAS_PAGOS_ELIMINAR),
  cuentasController.deletePago
);

/**
 * @route   PATCH /api/cuentas/pagos/:id/anular
 * @desc    Anular pago cuando exista soporte contable seguro
 * @access  Private (gerente)
 */
router.patch(
  '/pagos/:id/anular',
  requirePermission(PERMISSIONS.CUENTAS_PAGOS_ANULAR),
  cuentasController.voidPago
);

/**
 * @route   GET /api/cuentas/abonos/:num_factura
 * @desc    Obtener abonos de una factura
 * @access  Private (cuentas)
 */
router.get(
  '/abonos/:num_factura',
  requirePermission(PERMISSIONS.CUENTAS_ABONOS_VER),
  cuentasController.getAbonosByFactura
);

/**
 * @route   POST /api/cuentas/abonos/batch
 * @desc    Registrar múltiples abonos en una transacción (pago por cliente)
 * @access  Private (cuentas)
 */
router.post(
  '/abonos/batch',
  requirePermission(PERMISSIONS.CUENTAS_ABONOS_CREAR),
  validateRequest(pagoCreateSchema),
  cuentasController.createBatchAbono
);

/**
 * @route   DELETE /api/cuentas/abonos/:id
 * @desc    Eliminar un abono individual (gerente only)
 * @access  Private (gerente)
 */
router.delete(
  '/abonos/:id',
  requirePermission(PERMISSIONS.CUENTAS_ABONOS_ELIMINAR),
  cuentasController.deleteAbono
);

// ============================================
// REPORTE
// ============================================

/**
 * @route   GET /api/cuentas/reporte/excel
 * @desc    Exportar reporte a Excel
 * @access  Private (cuentas)
 */
router.get(
  '/reporte/excel',
  requirePermission(PERMISSIONS.CUENTAS_REPORTES_EXPORTAR),
  cuentasController.exportReporteExcel
);

/**
 * @route   GET /api/cuentas/reporte
 * @desc    Obtener reporte de cuentas por cobrar
 * @access  Private (cuentas)
 */
router.get(
  '/reporte',
  requirePermission(PERMISSIONS.CUENTAS_REPORTES_GENERAR),
  cuentasController.getReporte
);

module.exports = router;
