const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const ubicacionesController = require('../controllers/ubicacionesController');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');
const { validateRequest } = require('../middleware/validation');
const {
  articuloCreateSchema,
  articuloUpdateSchema,
  articuloBajaSchema,
  movimientoCreateSchema,
} = require