const express = require('express');
const router = express.Router();
const personalController = require('../controllers/personalController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');
const { validateRequest } = require('../middleware/validation');
const { colaboradorCreateSchema, colaboradorUpdateSchema } = require('../utils/validationSchemas');

router.use(verifyToken);

/**
 * @route   GET /api/personal/colaboradores
 * @desc    Obtener colaboradores
 */
router.get(
  '/colaboradores',
  requirePermission(PERMISSIONS.PERSONAL_VER),
  personalController.getColaboradores
);

/**
 * @route   POST /api/personal/colaboradores
 * @desc    Crear colaborador
 */
router.post(
  '/colaboradores',
  requirePermission(PERMISSIONS.PERSONAL_CREAR),
  validateRequest(colaboradorCreateSchema),
  personalController.createColaborador
);

/**
 * @route   PUT /api/personal/colaboradores/:id
 * @desc    Actualizar colaborador
 */
router.put(
  '/colaboradores/:id',
  requirePermission(PERMISSIONS.PERSONAL_EDITAR),
  validateRequest(colaboradorUpdateSchema),
  personalController.updateColaborador
);

/**
 * @route   DELETE /api/personal/colaboradores/:id
 * @desc    Eliminar colaborador
 */
router.delete(
  '/colaboradores/:id',
  requirePermission(PERMISSIONS.PERSONAL_ELIMINAR),
  personalController.deleteColaborador
);

/**
 * @route   GET /api/personal/colaboradores/excel
 * @desc    Exportar colaboradores a Excel
 */
router.get(
  '/colaboradores/excel',
  requirePermission(PERMISSIONS.PERSONAL_REPORTES_EXPORTAR),
  personalController.exportColaboradoresExcel
);

module.exports = router;
