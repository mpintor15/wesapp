const express = require('express');
const router = express.Router();
const personalController = require('../controllers/personalController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.use(verifyToken, requirePermission('personal'));

/**
 * @route   GET /api/personal/colaboradores
 * @desc    Obtener colaboradores
 */
router.get('/colaboradores', personalController.getColaboradores);

/**
 * @route   POST /api/personal/colaboradores
 * @desc    Crear colaborador
 */
router.post('/colaboradores', personalController.createColaborador);

/**
 * @route   PUT /api/personal/colaboradores/:id
 * @desc    Actualizar colaborador
 */
router.put('/colaboradores/:id', personalController.updateColaborador);

/**
 * @route   DELETE /api/personal/colaboradores/:id
 * @desc    Eliminar colaborador
 */
router.delete('/colaboradores/:id', personalController.deleteColaborador);

/**
 * @route   GET /api/personal/colaboradores/excel
 * @desc    Exportar colaboradores a Excel
 */
router.get('/colaboradores/excel', personalController.exportColaboradoresExcel);

module.exports = router;
