/**
 * inventarioController.js — Controlador del módulo de Inventario
 *
 * Gestiona cuatro entidades y sus exportaciones:
 *
 *  UBICACIONES
 *  - getUbicaciones   : Lista todos los lugares de almacenamiento.
 *
 *  ARTÍCULOS (via vista_inventario_alertas)
 *  - getArticulos     : Lista artículos con filtros de tipo, ubicación, estado y búsqueda.
 *  - createArticulo   : Crea un artículo (equipo, placa_balistica, arma, radio, otro).
 *                       Si se proporciona ubicacion_nombre en lugar de ID, crea
 *                       la ubicación automáticamente para un cliente activo.
 *  - updateArticulo   : Actualiza campos permitidos de un artículo existente.
 *  - deleteArticulo   : Para equipos con stock > 1 descuenta cantidad; si el
 *                       stock queda en 0 hace un soft-delete (activo=FALSE).
 *                       Para artículos serializados hace soft-delete directamente.
 *  - exportArticulosExcel : Descarga el inventario filtrado en formato .xlsx.
 *
 *  MOVIMIENTOS (traslados entre ubicaciones)
 *  - getMovimientos        : Lista todos los movimientos con su tipo (entrada/salida/traslado).
 *  - createMovimiento      : Registra un traslado dentro de una transacción:
 *                            · Valida origen ≠ destino para cada artículo.
 *                            · Para equipos con cantidad > 1 permite traslado parcial
 *                              clonando el artículo con la cantidad trasladada.
 *                            · Para artículos serializados solo acepta cantidad = 1.
 *                            · Genera automáticamente un PDF con el acta del traslado.
 *  - downloadMovimientoPdf : Descarga el PDF de acta generado para un movimiento.
 *
 *  PDF
 *  - generateMovimientoPdf : (interno) Genera el PDF con pdfkit, con tabla de
 *                            artículos, datos del traslado y casillas de firma.
 */
const db = require('../config/database');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  createHttpError,
  parsePositiveInteger,
  isConstraintOrInputError,
} = require('../utils/http');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const movementPdfStorage = require('../utils/movementPdfStorage');
const { validateOptionalDateBounds } = require('../utils/inputValidation');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const { sanitizeError } = require('../utils/logSanitizer');
const { assertClienteActivoForOperation } = require('../services/clientesStateService');
const { PERMISSIONS } = require('../config/permissions');
const { assertAnyPermission } = require('../middleware/permissions');
const {
  ALERTA_ESTADOS,
  ARTICULOS_SORT_COLUMNS,
  MOVIMIENTOS_SORT_COLUMNS,
} = require('../services/inventario/inventarioDomain');
const inventarioReadRepository = require('../repositories/inventario/inventarioReadRepository');

// Contrato permanente: crear un articulo puede crear su ubicacion contextual.
const ARTICULO_CONTEXTUAL_LOCATION_CREATE_PERMISSIONS = [
  PERMISSIONS.INVENTARIO_UBICACIONES_CREAR,
  PERMISSIONS.INVENTARIO_ARTICULOS_CREAR,
];
const MOVIMIENTO_LOCATION_CREATE_PERMISSIONS = [PERMISSIONS.INVENTARIO_UBICACIONES_CREAR];

const logControllerError = (message, error) => {
  logger.error(message, {
    error: sanitizeError(error),
    status: error.status,
  });
};

const validateInventoryDateBounds = (from, to) => {
  const validation = validateOptionalDateBounds(from, to, {
    invalidDateMessage: 'Las fechas deben tener formato YYYY-MM-DD y ser reales',
    invertedRangeMessage: 'El rango de fechas es inválido',
  });
  if (!validation.valid) {
    throw createHttpError(validation.status, validation.message);
  }
};

const buildBajasArticulosQuery = ({ search, from, to }) => {
  const params = [];
  const conditions = [];
  let query = `SELECT
      b.id,
      b.articulo_id,
      b.cantidad,
      b.motivo,
      b.fecha_baja,
      b.tipo_articulo,
      b.nombre_articulo,
      b.talla,
      b.marca,
      b.modelo,
      b.numero_serie,
      b.calibre,
      b.codigo_pantalla,
      b.codigo_radio,
      b.version,
      b.ubicacion_id,
      b.ubicacion_nombre,
      b.estado,
      b.anulado_por,
      b.anulado_en,
      b.motivo_anulacion,
      u.usuario
    FROM articulos_bajas b
    LEFT JOIN usuarios u ON u.id = b.usuario_id`;

  conditions.push('COALESCE(b.estado, $$ACTIVO$$) <> $$ELIMINADO$$');

  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(`(
      b.nombre_articulo ILIKE $${params.length} OR
      b.numero_serie ILIKE $${params.length} OR
      b.codigo_radio ILIKE $${params.length} OR
      b.marca ILIKE $${params.length} OR
      b.modelo ILIKE $${params.length} OR
      b.calibre ILIKE $${params.length} OR
      b.codigo_pantalla ILIKE $${params.length} OR
      b.version ILIKE $${params.length} OR
      b.ubicacion_nombre ILIKE $${params.length} OR
      b.motivo ILIKE $${params.length} OR
      u.usuario ILIKE $${params.length}
    )`);
  }

  if (from) {
    params.push(from);
    conditions.push(`b.fecha_baja::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`b.fecha_baja::date <= $${params.length}::date`);
  }

  query += ` WHERE ${conditions.join(' AND ')}`;

  query += ' ORDER BY b.fecha_baja DESC, b.id DESC';
  return { query, params };
};

// ============================================
// UBICACIONES
// ============================================

const getUbicaciones = async (req, res) => {
  try {
    const result = await db.query('SELECT id, nombre FROM ubicaciones ORDER BY nombre ASC');

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logControllerError('Error al obtener ubicaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
};

// ============================================
// ARTICULOS
// ============================================

const getArticulos = async (req, res) => {
  try {
    const { tipo, ubicacion_id, estado, search } = req.query;
    if (Object.prototype.hasOwnProperty.call(req.query, 'ubicacion_id')) {
      parsePositiveInteger(ubicacion_id, 'El filtro ubicación es inválido');
    }
    const normalizedEstado = estado ? String(estado).trim().toLowerCase() : '';
    if (estado && !ALERTA_ESTADOS.has(normalizedEstado)) {
      throw createHttpError(400, 'El filtro estado no es válido');
    }
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'created_at',
      allowedSorts: ARTICULOS_SORT_COLUMNS,
    });
    const { countResult, result } = await inventarioReadRepository.findArticulos({
      filters: {
        tipo,
        ubicacion_id,
        estado: estado ? normalizedEstado : undefined,
        search,
      },
      pagination,
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: buildPaginationMetadata({
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: countResult.rows[0]?.total,
      }),
    });
  } catch (error) {
    logControllerError('Error al obtener articulos:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error en el servidor',
    });
  }
};

const getArticulosCatalogo = async (req, res) => {
  try {
    const result = await inventarioReadRepository.findArticulosCatalogo();

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logControllerError('Error al obtener catálogo de articulos:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error en el servidor',
    });
  }
};

const normalizeEmpty = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  return value;
};

const isValidTipo = (tipo) => ['equipo', 'placa_balistica', 'arma', 'radio', 'otro'].includes(tipo);
const isStockTipo = (tipo) => tipo === 'equipo' || tipo === 'otro';
const getArticuloSerie = (articulo) =>
  articulo?.tipo_articulo === 'radio' ? articulo.codigo_radio : articulo?.numero_serie;

const createAppError = (status, code, message) => {
  const error = createHttpError(status, message);
  error.appCode = code;
  return error;
};

const normalizeLocationName = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const findUbicacionByClienteAndName = async (client, clienteId, nombre) =>
  client.query(
    `SELECT id
     FROM ubicaciones
     WHERE cliente_id = $1
       AND LOWER(TRIM(nombre)) = LOWER(TRIM($2))
     LIMIT 1`,
    [clienteId, nombre]
  );

const getOrCreateUbicacionForActiveCliente = async ({
  client,
  clienteId,
  nombre,
  requiredMessage,
  user,
  createPermissions = [],
}) => {
  if (!clienteId) {
    throw createHttpError(400, requiredMessage);
  }

  const existente = await findUbicacionByClienteAndName(client, clienteId, nombre);
  if (existente.rowCount > 0) {
    await assertClienteActivoForOperation({
      executor: client,
      clienteId,
      lockClause: 'FOR SHARE',
    });
    return existente.rows[0].id;
  }

  try {
    assertAnyPermission(user, ...createPermissions);
  } catch (permissionError) {
    const afterPermissionRace = await findUbicacionByClienteAndName(client, clienteId, nombre);
    if (afterPermissionRace.rowCount > 0) {
      await assertClienteActivoForOperation({
        executor: client,
        clienteId,
        lockClause: 'FOR SHARE',
      });
      return afterPermissionRace.rows[0].id;
    }
    throw permissionError;
  }

  await assertClienteActivoForOperation({
    executor: client,
    clienteId,
    lockClause: 'FOR SHARE',
  });

  try {
    const creado = await client.query(
      'INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2) RETURNING id',
      [nombre, clienteId]
    );
    return creado.rows[0].id;
  } catch (error) {
    if (error.code !== '23505') {
      throw error;
    }
    const afterRace = await findUbicacionByClienteAndName(client, clienteId, nombre);
    if (afterRace.rowCount === 0) {
      throw error;
    }
    return afterRace.rows[0].id;
  }
};

const resolveMovimientoDestino = async ({
  client,
  ubicacionId,
  ubicacionNombre,
  clienteDestinoId,
  user,
}) => {
  if (ubicacionId) {
    const destinoId = Number(ubicacionId);
    if (!Number.isInteger(destinoId) || destinoId <= 0) {
      throw createHttpError(400, 'La ubicación destino es inválida');
    }

    const existente = await client.query(
      `SELECT id, nombre, cliente_id
       FROM ubicaciones
       WHERE id = $1
       FOR SHARE`,
      [destinoId]
    );
    if (existente.rowCount === 0) {
      throw createAppError(404, 'LOCATION_NOT_FOUND', 'Ubicación destino no encontrada');
    }

    const destino = existente.rows[0];
    const persistedClienteId = destino.cliente_id === null ? null : Number(destino.cliente_id);
    if (clienteDestinoId && persistedClienteId !== clienteDestinoId) {
      throw createAppError(
        409,
        'LOCATION_CLIENT_MISMATCH',
        'La ubicación destino no pertenece al cliente destino indicado'
      );
    }
    if (ubicacionNombre && normalizeLocationName(destino.nombre) !== ubicacionNombre) {
      throw createAppError(
        409,
        'LOCATION_PAYLOAD_CONFLICT',
        'La ubicación destino no coincide con el nombre enviado'
      );
    }
    return destinoId;
  }

  if (ubicacionNombre) {
    return getOrCreateUbicacionForActiveCliente({
      client,
      clienteId: clienteDestinoId,
      nombre: ubicacionNombre,
      requiredMessage: 'El cliente destino es obligatorio para crear una ubicación nueva',
      user,
      createPermissions: MOVIMIENTO_LOCATION_CREATE_PERMISSIONS,
    });
  }

  throw createHttpError(400, 'La ubicación destino es requerida para traslados');
};

const validateDetailedReason = (value, fieldName = 'motivo') => {
  if (typeof value !== 'string') {
    throw createHttpError(400, `El ${fieldName} es requerido`);
  }

  const reason = value.trim();
  if (reason.length < 10) {
    throw createHttpError(400, `El ${fieldName} debe tener al menos 10 caracteres`);
  }
  if (reason.length > 500) {
    throw createHttpError(400, `El ${fieldName} no puede exceder 500 caracteres`);
  }
  return reason;
};

const sendInventoryError = (res, error, logMessage) => {
  logControllerError(logMessage, error);
  const status = error.status || (isConstraintOrInputError(error) ? 400 : 500);
  const body = {
    success: false,
    message: status >= 500 ? 'Error en el servidor' : error.message || 'Solicitud inválida',
  };
  if (error.appCode) {
    body.code = error.appCode;
  }
  return res.status(status).json(body);
};

const ensureNonNegativeStock = (value, code = 'INSUFFICIENT_STOCK') => {
  if (Number(value) < 0) {
    throw createAppError(409, code, 'Stock insuficiente');
  }
};

const lockArticulosByIds = async (client, ids) => {
  const uniqueIds = [
    ...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)),
  ].sort((a, b) => a - b);
  if (!uniqueIds.length) {
    return new Map();
  }

  const result = await client.query(
    `SELECT *
     FROM articulos
     WHERE id = ANY($1::int[])
     ORDER BY id ASC
     FOR UPDATE`,
    [uniqueIds]
  );

  return new Map(result.rows.map((row) => [Number(row.id), row]));
};

const recordStockEffect = async (
  client,
  {
    movimiento_id = null,
    baja_id = null,
    articulo_id,
    delta,
    stock_anterior,
    stock_posterior,
    ubicacion_anterior_id,
    ubicacion_posterior_id,
  }
) => {
  await client.query(
    `INSERT INTO inventario_stock_efectos (
      movimiento_id,
      baja_id,
      articulo_id,
      delta,
      stock_anterior,
      stock_posterior,
      ubicacion_anterior_id,
      ubicacion_posterior_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      movimiento_id,
      baja_id,
      articulo_id,
      delta,
      stock_anterior,
      stock_posterior,
      ubicacion_anterior_id,
      ubicacion_posterior_id,
    ]
  );
};

const applyInverseStockEffect = async (client, effect, articulo, code) => {
  if (!articulo) {
    throw createAppError(409, code, 'No se puede revertir: artículo no disponible');
  }

  const currentStock = Number(articulo.cantidad) || 0;
  const reversedStock = currentStock - Number(effect.delta);
  ensureNonNegativeStock(reversedStock, code);

  const shouldDeactivate =
    reversedStock === 0 && effect.ubicacion_anterior_id === null && effect.delta > 0;
  const nextLocation =
    effect.ubicacion_anterior_id === undefined
      ? articulo.ubicacion_id
      : effect.ubicacion_anterior_id;

  await client.query(
    `UPDATE articulos
     SET cantidad = $1,
         activo = $2,
         ubicacion_id = $3
     WHERE id = $4`,
    [reversedStock, !shouldDeactivate, nextLocation, articulo.id]
  );
};

const getUniqueArticuloMessage = (error) => {
  const constraint = error.constraint || '';
  const detail = error.detail || '';
  if (constraint.includes('codigo_pantalla') || detail.includes('codigo_pantalla')) {
    return 'Ya existe un artículo con ese código de pantalla';
  }
  if (constraint.includes('codigo_radio') || detail.includes('codigo_radio')) {
    return 'Ya existe un artículo con ese número de serie';
  }
  if (constraint.includes('version') || detail.includes('(version)')) {
    return 'Ya existe un artículo con esa versión';
  }
  return 'Ya existe un artículo con ese número de serie';
};

const createArticulo = async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const {
      tipo_articulo,
      nombre_articulo,
      cantidad,
      talla,
      marca,
      modelo,
      numero_serie,
      calibre,
      fecha_caducidad,
      ubicacion_id,
      cliente_id,
      ubicacion_nombre,
      codigo_pantalla,
      codigo_radio,
      version,
    } = req.body;

    if (!tipo_articulo || !isValidTipo(tipo_articulo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de articulo inválido',
      });
    }

    if (!nombre_articulo || !String(nombre_articulo).trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del artículo es requerido',
      });
    }

    if (isStockTipo(tipo_articulo)) {
      const parsedCantidad = Number(cantidad);
      if (!Number.isInteger(parsedCantidad) || parsedCantidad <= 0) {
        return res.status(400).json({
          success: false,
          message: 'La cantidad debe ser un entero mayor a 0',
        });
      }
    }

    let ubicacionId = ubicacion_id;
    const clienteId = cliente_id
      ? parsePositiveInteger(cliente_id, 'El cliente es inválido')
      : null;
    const ubicacionNombre = normalizeLocationName(ubicacion_nombre);

    client = await db.getClient();
    await client.query('BEGIN');
    transactionStarted = true;

    if (clienteId && (ubicacionId || !ubicacionNombre)) {
      await assertClienteActivoForOperation({
        executor: client,
        clienteId,
        lockClause: 'FOR SHARE',
      });
    }

    if (ubicacionId && clienteId) {
      const ubicacionClienteRes = await client.query(
        'SELECT id FROM ubicaciones WHERE id = $1 AND cliente_id = $2',
        [ubicacionId, clienteId]
      );
      if (ubicacionClienteRes.rowCount === 0) {
        throw createHttpError(400, 'La ubicación no pertenece al cliente seleccionado');
      }
    }

    if (!ubicacionId && ubicacionNombre) {
      ubicacionId = await getOrCreateUbicacionForActiveCliente({
        client,
        clienteId,
        nombre: ubicacionNombre,
        requiredMessage: 'El cliente es obligatorio para crear una ubicación nueva',
        user: req.user,
        createPermissions: ARTICULO_CONTEXTUAL_LOCATION_CREATE_PERMISSIONS,
      });
    }

    if (!ubicacionId) {
      throw createHttpError(400, 'La ubicación es requerida');
    }

    const result = await client.query(
      `INSERT INTO articulos (
        tipo_articulo,
        nombre_articulo,
        cantidad,
        talla,
        marca,
        modelo,
        numero_serie,
        calibre,
        fecha_caducidad,
        ubicacion_id,
        codigo_pantalla,
        codigo_radio,
        version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id, codigo_pantalla, codigo_radio, version`,
      [
        tipo_articulo,
        normalizeEmpty(nombre_articulo),
        cantidad ? parseInt(cantidad, 10) : !isStockTipo(tipo_articulo) ? 1 : null,
        normalizeEmpty(talla),
        normalizeEmpty(marca),
        normalizeEmpty(modelo),
        tipo_articulo === 'radio' ? null : normalizeEmpty(numero_serie),
        normalizeEmpty(calibre),
        normalizeEmpty(fecha_caducidad),
        parseInt(ubicacionId, 10),
        normalizeEmpty(codigo_pantalla),
        normalizeEmpty(codigo_radio),
        normalizeEmpty(version),
      ]
    );

    await logAuditStrict(client, {
      tabla: 'articulos',
      operacion: 'INSERT',
      registro_id: String(result.rows[0].id),
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: 'Artículo creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (transactionStarted && client) {
      await client.query('ROLLBACK');
    }
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: getUniqueArticuloMessage(error),
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'La ubicación especificada no existe',
      });
    }
    sendInventoryError(res, error, 'Error al crear artículo:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const updateArticulo = async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del artículo es inválido');
    const allowedFields = [
      'tipo_articulo',
      'nombre_articulo',
      'cantidad',
      'talla',
      'marca',
      'modelo',
      'numero_serie',
      'calibre',
      'fecha_caducidad',
      'ubicacion_id',
      'codigo_pantalla',
      'codigo_radio',
      'version',
    ];

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, 'tipo_articulo')) {
      if (!isValidTipo(req.body.tipo_articulo)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de articulo inválido',
        });
      }
    }

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        let value = req.body[field];
        if (field === 'cantidad' && value !== null && value !== undefined && value !== '') {
          value = parseInt(value, 10);
          if (!Number.isInteger(value) || value < 0) {
            throw createHttpError(400, 'La cantidad no puede ser negativa');
          }
        }
        if (field === 'ubicacion_id' && value !== null && value !== undefined && value !== '') {
          value = parseInt(value, 10);
        }
        updates.push(`${field} = $${values.length + 1}`);
        values.push(normalizeEmpty(value));
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar',
      });
    }

    values.push(id);

    client = await db.getClient();
    await client.query('BEGIN');
    transactionStarted = true;

    const currentRes = await client.query('SELECT * FROM articulos WHERE id = $1 FOR UPDATE', [id]);
    if (currentRes.rowCount === 0) {
      throw createHttpError(404, 'Artículo no encontrado');
    }

    const result = await client.query(
      `UPDATE articulos SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, tipo_articulo, nombre_articulo, cantidad, talla, marca, modelo, numero_serie, calibre, fecha_caducidad, ubicacion_id`,
      values
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, 'Artículo no encontrado');
    }

    await logAuditStrict(client, {
      tabla: 'articulos',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: currentRes.rows[0],
      datos_nuevos: result.rows[0],
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    transactionStarted = false;

    res.json({
      success: true,
      message: 'Artículo actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (transactionStarted && client) {
      await client.query('ROLLBACK');
    }
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: getUniqueArticuloMessage(error),
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'La ubicación especificada no existe',
      });
    }
    logControllerError('Error al actualizar artículo:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error en el servidor',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const deleteArticulo = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del artículo es inválido');
    if (req.query?.cantidad !== undefined || req.body?.cantidad !== undefined) {
      throw createAppError(
        409,
        'PARTIAL_ARTICLE_DELETE_DEPRECATED',
        'La eliminación parcial por DELETE está obsoleta; usa baja de artículo o un ajuste explícito de inventario'
      );
    }
    const motivo = validateDetailedReason(req.body?.motivo, 'motivo de eliminación');

    client = await db.getClient();
    await client.query('BEGIN');

    const articuloRes = await client.query(
      `SELECT *
       FROM articulos
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (articuloRes.rowCount === 0) {
      throw createHttpError(404, 'Artículo no encontrado');
    }

    const articulo = articuloRes.rows[0];
    const historialRes = await client.query(
      `SELECT
        EXISTS (SELECT 1 FROM detalle_movimientos WHERE articulo_id = $1) AS tiene_movimientos,
        EXISTS (SELECT 1 FROM articulos_bajas WHERE articulo_id = $1) AS tiene_bajas`,
      [id]
    );

    const result = await client.query(
      `UPDATE articulos
       SET activo = FALSE,
           cantidad = 0,
           ubicacion_id = NULL,
           eliminado_por = $2,
           eliminado_en = CURRENT_TIMESTAMP,
           motivo_eliminacion = $3
       WHERE id = $1
       RETURNING id, activo, cantidad, ubicacion_id, eliminado_por, eliminado_en, motivo_eliminacion`,
      [id, req.user?.id || null, motivo]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, 'Artículo no encontrado');
    }

    await logAuditStrict(client, {
      tabla: 'articulos',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: articulo,
      datos_nuevos: {
        ...result.rows[0],
        motivo_eliminacion: motivo,
        tiene_historial: Boolean(
          historialRes.rows[0]?.tiene_movimientos || historialRes.rows[0]?.tiene_bajas
        ),
      },
      ...auditFromReq(req),
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Artículo eliminado exitosamente',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    sendInventoryError(res, error, 'Error al eliminar artículo:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const getBajasArticulos = async (req, res) => {
  try {
    const { search, from, to } = req.query;
    validateInventoryDateBounds(from, to);
    const { query, params } = buildBajasArticulosQuery({ search, from, to });
    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    sendInventoryError(res, error, 'Error al obtener bajas de artículos:');
  }
};

const darBajaArticulo = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del artículo es inválido');
    const motivo = req.body?.motivo ? String(req.body.motivo).trim() : '';
    const cantidadSolicitada = Number.parseInt(req.body?.cantidad, 10);

    if (!motivo) {
      return res.status(400).json({
        success: false,
        message: 'El motivo de la baja es requerido',
      });
    }

    client = await db.getClient();
    await client.query('BEGIN');

    const articuloRes = await client.query(
      `SELECT
        a.id,
        a.tipo_articulo,
        a.nombre_articulo,
        a.cantidad,
        a.talla,
        a.marca,
        a.modelo,
        a.numero_serie,
        a.calibre,
        a.codigo_pantalla,
        a.codigo_radio,
        a.version,
        a.ubicacion_id,
        u.nombre AS ubicacion_nombre
       FROM articulos a
       LEFT JOIN ubicaciones u ON u.id = a.ubicacion_id
       WHERE a.id = $1 AND a.activo = TRUE
       FOR UPDATE OF a`,
      [id]
    );

    if (articuloRes.rowCount === 0) {
      throw createHttpError(404, 'Artículo no encontrado');
    }

    const articulo = articuloRes.rows[0];
    const cantidadActual = Number.parseInt(articulo.cantidad, 10) || 1;
    const cantidadBaja = isStockTipo(articulo.tipo_articulo) ? cantidadSolicitada : 1;

    if (!Number.isInteger(cantidadBaja) || cantidadBaja <= 0) {
      throw createHttpError(400, 'La cantidad a dar de baja debe ser mayor a 0');
    }

    if (cantidadBaja > cantidadActual) {
      throw createAppError(
        409,
        'INSUFFICIENT_STOCK',
        'La cantidad a dar de baja supera el stock disponible'
      );
    }

    const bajaInsertRes = await client.query(
      `INSERT INTO articulos_bajas (
        articulo_id,
        usuario_id,
        cantidad,
        motivo,
        tipo_articulo,
        nombre_articulo,
        talla,
        marca,
        modelo,
        numero_serie,
        calibre,
        codigo_pantalla,
        codigo_radio,
        version,
        ubicacion_id,
        ubicacion_nombre,
        reversion_datos_completos
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, TRUE)
       RETURNING id`,
      [
        articulo.id,
        req.user?.id || null,
        cantidadBaja,
        motivo,
        articulo.tipo_articulo,
        articulo.nombre_articulo,
        articulo.talla,
        articulo.marca,
        articulo.modelo,
        articulo.numero_serie,
        articulo.calibre,
        articulo.codigo_pantalla,
        articulo.codigo_radio,
        articulo.version,
        articulo.ubicacion_id,
        articulo.ubicacion_nombre,
      ]
    );

    const restante = cantidadActual - cantidadBaja;
    if (restante > 0) {
      await client.query('UPDATE articulos SET cantidad = $1 WHERE id = $2', [
        restante,
        articulo.id,
      ]);
    } else {
      await client.query('UPDATE articulos SET cantidad = 0, activo = FALSE WHERE id = $1', [
        articulo.id,
      ]);
    }

    await recordStockEffect(client, {
      baja_id: bajaInsertRes.rows[0].id,
      articulo_id: articulo.id,
      delta: -cantidadBaja,
      stock_anterior: cantidadActual,
      stock_posterior: restante,
      ubicacion_anterior_id: articulo.ubicacion_id,
      ubicacion_posterior_id: articulo.ubicacion_id,
    });

    await logAuditStrict(client, {
      tabla: 'articulos_bajas',
      operacion: 'INSERT',
      registro_id: String(bajaInsertRes.rows[0].id),
      datos_nuevos: {
        id: bajaInsertRes.rows[0].id,
        articulo_id: articulo.id,
        cantidad: cantidadBaja,
        motivo,
        restante,
      },
      ...auditFromReq(req),
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message:
        restante > 0 ? 'Cantidad dada de baja exitosamente' : 'Artículo dado de baja exitosamente',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    sendInventoryError(res, error, 'Error al dar de baja artículo:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

// ============================================
// MOVIMIENTOS
// ============================================

const getMovimientos = async (req, res) => {
  try {
    const { from, to, destino_id, search } = req.query;
    validateInventoryDateBounds(from, to);
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'fecha_movimiento',
      allowedSorts: MOVIMIENTOS_SORT_COLUMNS,
    });
    const { countResult, result } = await inventarioReadRepository.findMovimientos({
      search,
      destino_id,
      from,
      to,
      pagination,
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: buildPaginationMetadata({
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: countResult.rows[0]?.total,
      }),
    });
  } catch (error) {
    sendInventoryError(res, error, 'Error al obtener movimientos:');
  }
};

const buildMovimientosReporteQuery = ({ from, to, destino_id }) => {
  const params = [];
  const conditions = [];

  if (from) {
    params.push(from);
    conditions.push(`m.fecha_movimiento::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`m.fecha_movimiento::date <= $${params.length}::date`);
  }

  if (destino_id) {
    params.push(parsePositiveInteger(destino_id, 'El filtro destino es inválido'));
    conditions.push(`d.ubicacion_destino_id = $${params.length}`);
  }

  conditions.push('COALESCE(m.estado, $$ACTIVO$$) <> $$ELIMINADO$$');

  const where = `WHERE ${conditions.join(' AND ')}`;

  return {
    params,
    query: `
      SELECT
        m.id,
        m.fecha_movimiento,
        m.estado,
        m.anulado_en,
        m.motivo_anulacion,
        u.usuario,
        COALESCE(SUM(d.cantidad), 0)::INT AS items,
        STRING_AGG(
          DISTINCT COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo'),
          ', '
          ORDER BY COALESCE(NULLIF(a.nombre_articulo, ''), NULLIF(a.numero_serie, ''), 'Artículo')
        ) AS articulos_movidos,
        STRING_AGG(DISTINCT ao.nombre, ', ' ORDER BY ao.nombre) AS ubicacion_origen,
        CASE
          WHEN COUNT(DISTINCT d.ubicacion_destino_id) = 1 THEN MAX(ad.nombre)
          ELSE NULL
        END AS ubicacion_destino
      FROM movimientos m
      LEFT JOIN detalle_movimientos d ON d.movimiento_id = m.id
      LEFT JOIN articulos a ON d.articulo_id = a.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
      LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
      ${where}
      GROUP BY m.id, u.usuario
      ORDER BY m.fecha_movimiento DESC`,
  };
};

const getMovimientoDataForPdf = async (movimientoId) => {
  const result = await db.query(
    `SELECT 
      m.id,
      m.fecha_movimiento,
      u.usuario,
      d.cantidad,
      a.tipo_articulo,
      a.nombre_articulo,
      a.numero_serie,
      a.codigo_radio,
      a.marca,
      a.modelo,
      a.calibre,
      ao.nombre AS ubicacion_origen,
      ad.nombre AS ubicacion_destino
    FROM movimientos m
    JOIN usuarios u ON m.usuario_id = u.id
    JOIN detalle_movimientos d ON d.movimiento_id = m.id
    JOIN articulos a ON d.articulo_id = a.id
    LEFT JOIN ubicaciones ao ON d.ubicacion_origen_id = ao.id
    LEFT JOIN ubicaciones ad ON d.ubicacion_destino_id = ad.id
    WHERE m.id = $1
    ORDER BY d.id ASC`,
    [movimientoId]
  );

  return result.rows;
};

// ============================================
// EXPORTAR INVENTARIO (EXCEL)
// ============================================

const TIPO_LABELS = {
  equipo: 'Equipo',
  placa_balistica: 'Placa Balística',
  arma: 'Arma',
  radio: 'Radio',
  otro: 'Otro',
};
const ESTADO_LABELS = {
  vencida: 'Vencida',
  proxima_a_vencer: 'Próxima a vencer',
  vigente: 'Vigente',
};

const exportArticulosExcel = async (req, res) => {
  try {
    const { tipo, ubicacion_id, estado, search } = req.query;
    if (Object.prototype.hasOwnProperty.call(req.query, 'ubicacion_id')) {
      parsePositiveInteger(ubicacion_id, 'El filtro ubicación es inválido');
    }
    const normalizedEstado = estado ? String(estado).trim().toLowerCase() : '';
    if (estado && !ALERTA_ESTADOS.has(normalizedEstado)) {
      throw createHttpError(400, 'El filtro estado no es válido');
    }
    const result = await inventarioReadRepository.findArticulosForExport({
      tipo,
      ubicacion_id,
      search,
      estado: estado ? normalizedEstado : undefined,
    });

    const { workbook, worksheet } = createWorkbook('Inventario', [
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Artículo', key: 'nombre', width: 28 },
      { header: 'Serie', key: 'serie', width: 18 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Talla', key: 'talla', width: 10 },
      { header: 'Marca', key: 'marca', width: 16 },
      { header: 'Modelo', key: 'modelo', width: 16 },
      { header: 'Calibre', key: 'calibre', width: 12 },
      { header: 'Cód. Pantalla', key: 'codigo_pantalla', width: 16 },
      { header: 'Versión', key: 'version', width: 14 },
      { header: 'Caducidad', key: 'caducidad', width: 14 },
      { header: 'Ubicación', key: 'ubicacion', width: 20 },
      { header: 'Estado', key: 'estado', width: 16 },
    ]);

    result.rows.forEach((row) =>
      worksheet.addRow({
        tipo: TIPO_LABELS[row.tipo_articulo] ?? row.tipo_articulo ?? '',
        nombre: row.nombre_articulo || '',
        serie: getArticuloSerie(row) || '',
        cantidad: row.cantidad || '',
        talla: row.talla || '',
        marca: row.marca || '',
        modelo: row.modelo || '',
        calibre: row.calibre || '',
        codigo_pantalla: row.codigo_pantalla || '',
        version: row.version || '',
        caducidad: row.fecha_caducidad
          ? new Date(row.fecha_caducidad).toLocaleDateString('es-EC')
          : '',
        ubicacion: row.ubicacion_nombre || '',
        estado: ESTADO_LABELS[row.estado_caducidad] ?? 'Sin alerta',
      })
    );

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'inventario.xlsx');
  } catch (error) {
    logControllerError('Error al exportar inventario:', error);
    res
      .status(error.status || 500)
      .json({ success: false, message: error.status ? error.message : 'Error al exportar Excel' });
  }
};

const exportMovimientosExcel = async (req, res) => {
  try {
    const { from, to, destino_id } = req.query;
    validateInventoryDateBounds(from, to);
    if (Object.prototype.hasOwnProperty.call(req.query, 'destino_id')) {
      parsePositiveInteger(destino_id, 'El filtro destino es inválido');
    }
    const { query, params } = buildMovimientosReporteQuery({ from, to, destino_id });
    const result = await db.query(query, params);

    const { workbook, worksheet } = createWorkbook('Movimientos', [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Cant. Artíc.', key: 'items', width: 14 },
      { header: 'Artículos', key: 'articulos', width: 40 },
      { header: 'Origen', key: 'origen', width: 24 },
      { header: 'Destino', key: 'destino', width: 24 },
      { header: 'Usuario', key: 'usuario', width: 18 },
    ]);

    result.rows.forEach((row) =>
      worksheet.addRow({
        fecha: row.fecha_movimiento
          ? new Date(row.fecha_movimiento).toLocaleDateString('es-EC')
          : '',
        items: row.items || 0,
        articulos: row.articulos_movidos || '',
        origen: row.ubicacion_origen || '',
        destino: row.ubicacion_destino || '',
        usuario: row.usuario || '',
      })
    );

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'movimientos-inventario.xlsx');
  } catch (error) {
    logControllerError('Error al exportar movimientos:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error al exportar movimientos',
    });
  }
};

const exportBajasArticulosExcel = async (req, res) => {
  try {
    const { search, from, to } = req.query;
    validateInventoryDateBounds(from, to);
    const { query, params } = buildBajasArticulosQuery({ search, from, to });
    const result = await db.query(query, params);

    const { workbook, worksheet } = createWorkbook('Dados de baja', [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Artículo', key: 'articulo', width: 28 },
      { header: 'Serie', key: 'serie', width: 22 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Marca', key: 'marca', width: 16 },
      { header: 'Modelo', key: 'modelo', width: 18 },
      { header: 'Calibre', key: 'calibre', width: 12 },
      { header: 'Ubicación', key: 'ubicacion', width: 24 },
      { header: 'Usuario', key: 'usuario', width: 18 },
      { header: 'Motivo', key: 'motivo', width: 42 },
    ]);

    result.rows.forEach((row) =>
      worksheet.addRow({
        fecha: row.fecha_baja ? new Date(row.fecha_baja).toLocaleDateString('es-EC') : '',
        tipo: TIPO_LABELS[row.tipo_articulo] ?? row.tipo_articulo ?? '',
        articulo: row.nombre_articulo || '',
        serie: getArticuloSerie(row) || '',
        cantidad: row.cantidad || '',
        marca: row.marca || '',
        modelo: row.modelo || '',
        calibre: row.calibre || '',
        ubicacion: row.ubicacion_nombre || '',
        usuario: row.usuario || '',
        motivo: row.motivo || '',
      })
    );

    styleDataRows(worksheet);
    await sendExcel(workbook, res, 'articulos-dados-de-baja.xlsx');
  } catch (error) {
    sendInventoryError(res, error, 'Error al exportar bajas de artículos:');
  }
};

const generateMovimientoPdf = async (movimientoId) => {
  const detalles = await getMovimientoDataForPdf(movimientoId);
  if (!detalles.length) {
    return null;
  }

  const fechaMovimiento = detalles[0].fecha_movimiento;
  const usuario = detalles[0].usuario || 'N/A';
  const ubicacionDestino = detalles[0].ubicacion_destino || 'N/A';

  const writer = await movementPdfStorage.createAtomicWrite(movimientoId);
  const doc = new PDFDocument({ margin: 40 });
  const stream = writer.stream;
  doc.pipe(stream);

  try {
    // Header with optional logo
    const logoPath = path.join(__dirname, '..', 'assets', 'wes-logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 480, 25, { width: 70 });
    }
    doc.fontSize(18).text('Movimiento de Inventario', { align: 'center' });
    doc.moveDown(1.8);

    // Movement info
    doc.fontSize(11);
    const infoLeft = 60;
    doc.text(`Movimiento realizado por: ${usuario}`, infoLeft);
    doc.text(
      `Fecha del movimiento: ${new Date(fechaMovimiento).toLocaleDateString('es-EC')}`,
      infoLeft
    );
    doc.text(`Ubicación destino: ${ubicacionDestino}`, infoLeft);
    doc.moveDown();

    // Table header
    const tableTop = doc.y + 5;
    const colQty = 40;
    const colItem = 110;
    const colSerial = 360;
    const colOrigin = 470;

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Cantidad', colQty, tableTop);
    doc.text('Artículo', colItem, tableTop);
    doc.text('Serie', colSerial, tableTop);
    doc.text('Ubicación actual', colOrigin, tableTop);
    doc
      .moveTo(40, tableTop + 15)
      .lineTo(555, tableTop + 15)
      .stroke();

    doc.font('Helvetica');
    let rowY = tableTop + 25;
    detalles.forEach((item) => {
      const qty = item.cantidad || 1;
      const name = item.nombre_articulo || 'Artículo';
      const serial = getArticuloSerie(item) || '-';
      const origin = item.ubicacion_origen || '-';
      doc.text(String(qty), colQty, rowY);
      doc.text(name, colItem, rowY, { width: 240 });
      doc.text(serial, colSerial, rowY, { width: 90 });
      doc.text(origin, colOrigin, rowY, { width: 120 });
      rowY += 18;
    });

    doc.moveDown(2);

    // Signature boxes
    const lineWidth = 220;
    const signatureTop = doc.page.height - 90;
    const pageCenter = doc.page.width / 2;
    const gapBetween = 40;
    const leftLineStart = pageCenter - gapBetween / 2 - lineWidth;
    const rightLineStart = pageCenter + gapBetween / 2;

    doc
      .moveTo(leftLineStart, signatureTop)
      .lineTo(leftLineStart + lineWidth, signatureTop)
      .stroke();
    doc
      .moveTo(rightLineStart, signatureTop)
      .lineTo(rightLineStart + lineWidth, signatureTop)
      .stroke();

    doc.fontSize(10).text('Firma de quien realiza', leftLineStart, signatureTop + 6, {
      width: lineWidth,
      align: 'center',
    });
    doc.text('Firma de quien recibe', rightLineStart, signatureTop + 6, {
      width: lineWidth,
      align: 'center',
    });

    doc.end();

    await writer.finished;
    await writer.commit();
  } catch (error) {
    stream.destroy();
    await writer.cleanup();
    throw error;
  }

  return { fullPath: writer.fullPath, relativePath: writer.relativePath };
};

const createMovimiento = async (req, res) => {
  let client;
  let transactionStarted = false;
  let movimientoId;

  try {
    const {
      ubicacion_destino_id,
      ubicacion_destino_nombre,
      cliente_destino_id,
      items,
      fecha_movimiento,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw createHttpError(400, 'Debes agregar al menos un artículo');
    }

    const normalizedItems = items
      .map((item) => ({
        articulo_id: Number(item?.articulo_id),
        cantidad: item?.cantidad === undefined ? 1 : Number(item.cantidad),
        talla: item?.talla ? String(item.talla).trim() : '',
      }))
      .sort((a, b) => a.articulo_id - b.articulo_id);

    for (const item of normalizedItems) {
      if (!Number.isInteger(item.articulo_id) || item.articulo_id <= 0) {
        throw createHttpError(400, 'Artículo inválido');
      }
      if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        throw createHttpError(400, 'Cantidad inválida');
      }
    }

    let destinoId = ubicacion_destino_id;
    const destinoNombre = normalizeLocationName(ubicacion_destino_nombre);
    const clienteDestinoId = cliente_destino_id
      ? parsePositiveInteger(cliente_destino_id, 'El cliente destino es inválido')
      : null;

    client = await db.getClient();
    await client.query('BEGIN');
    transactionStarted = true;

    destinoId = await resolveMovimientoDestino({
      client,
      ubicacionId: destinoId,
      ubicacionNombre: destinoNombre,
      clienteDestinoId,
      user: req.user,
    });

    const lockedArticulos = await lockArticulosByIds(
      client,
      normalizedItems.map((item) => item.articulo_id)
    );
    const detalleRows = [];
    const stockEffects = [];

    for (const item of normalizedItems) {
      const articulo = lockedArticulos.get(item.articulo_id);
      if (!articulo || articulo.activo === false) {
        throw createHttpError(400, `Artículo #${item.articulo_id} no encontrado`);
      }

      if (!isStockTipo(articulo.tipo_articulo) && item.cantidad > 1) {
        throw createHttpError(400, 'La cantidad debe ser 1 para artículos serializados');
      }

      const origenArticuloId = articulo.ubicacion_id;
      if (!origenArticuloId) {
        throw createHttpError(400, 'El artículo no tiene ubicación origen');
      }
      if (String(origenArticuloId) === String(destinoId)) {
        throw createHttpError(400, 'El destino no puede ser igual al origen del artículo');
      }

      let movedArticuloId = articulo.id;

      if (isStockTipo(articulo.tipo_articulo)) {
        if (articulo.talla && !item.talla) {
          throw createHttpError(400, 'Debes indicar la talla del artículo');
        }
        if (articulo.talla && item.talla && articulo.talla !== item.talla) {
          throw createHttpError(400, 'La talla indicada no coincide con el artículo');
        }

        const actual = Number(articulo.cantidad) || 0;
        const restante = actual - item.cantidad;
        if (restante < 0) {
          throw createAppError(409, 'INSUFFICIENT_STOCK', 'Cantidad supera el stock disponible');
        }
        if (item.cantidad < actual && articulo.numero_serie) {
          throw createHttpError(400, 'No se puede fraccionar un artículo con número de serie');
        }

        if (item.cantidad < actual) {
          const tallaFinal = item.talla || articulo.talla || null;
          const insertRes = await client.query(
            `INSERT INTO articulos (
              tipo_articulo,
              nombre_articulo,
              cantidad,
              talla,
              marca,
              modelo,
              numero_serie,
              calibre,
              fecha_caducidad,
              ubicacion_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING id`,
            [
              articulo.tipo_articulo,
              articulo.nombre_articulo,
              item.cantidad,
              tallaFinal,
              articulo.marca,
              articulo.modelo,
              articulo.numero_serie,
              articulo.calibre,
              articulo.fecha_caducidad,
              destinoId,
            ]
          );
          await client.query('UPDATE articulos SET cantidad = $1 WHERE id = $2', [
            restante,
            articulo.id,
          ]);
          stockEffects.push({
            articulo_id: articulo.id,
            delta: -item.cantidad,
            stock_anterior: actual,
            stock_posterior: restante,
            ubicacion_anterior_id: origenArticuloId,
            ubicacion_posterior_id: origenArticuloId,
          });
          stockEffects.push({
            articulo_id: insertRes.rows[0].id,
            delta: item.cantidad,
            stock_anterior: 0,
            stock_posterior: item.cantidad,
            ubicacion_anterior_id: null,
            ubicacion_posterior_id: destinoId,
          });
          articulo.cantidad = restante;
          movedArticuloId = insertRes.rows[0].id;
        } else {
          await client.query('UPDATE articulos SET ubicacion_id = $1 WHERE id = $2', [
            destinoId,
            articulo.id,
          ]);
          stockEffects.push({
            articulo_id: articulo.id,
            delta: 0,
            stock_anterior: actual,
            stock_posterior: actual,
            ubicacion_anterior_id: origenArticuloId,
            ubicacion_posterior_id: destinoId,
          });
          articulo.ubicacion_id = destinoId;
        }
      } else {
        if (item.cantidad !== 1) {
          throw createHttpError(400, 'La cantidad debe ser 1 para artículos serializados');
        }
        await client.query('UPDATE articulos SET ubicacion_id = $1 WHERE id = $2', [
          destinoId,
          articulo.id,
        ]);
        stockEffects.push({
          articulo_id: articulo.id,
          delta: 0,
          stock_anterior: Number(articulo.cantidad) || 1,
          stock_posterior: Number(articulo.cantidad) || 1,
          ubicacion_anterior_id: origenArticuloId,
          ubicacion_posterior_id: destinoId,
        });
        articulo.ubicacion_id = destinoId;
      }

      detalleRows.push({
        articulo_id: movedArticuloId,
        cantidad: item.cantidad,
        ubicacion_origen_id: origenArticuloId,
        ubicacion_destino_id: destinoId,
      });
    }

    const movimientoRes = await client.query(
      `INSERT INTO movimientos (usuario_id, fecha_movimiento, estado, reversion_datos_completos)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), 'ACTIVO', TRUE)
       RETURNING id, fecha_movimiento, estado`,
      [req.user.id, fecha_movimiento || null]
    );

    movimientoId = movimientoRes.rows[0].id;

    for (const detalle of detalleRows) {
      await client.query(
        `INSERT INTO detalle_movimientos (
          movimiento_id,
          articulo_id,
          cantidad,
          ubicacion_origen_id,
          ubicacion_destino_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          movimientoId,
          detalle.articulo_id,
          detalle.cantidad,
          detalle.ubicacion_origen_id,
          detalle.ubicacion_destino_id,
        ]
      );
    }

    for (const effect of stockEffects) {
      await recordStockEffect(client, { movimiento_id: movimientoId, ...effect });
    }

    await logAuditStrict(client, {
      tabla: 'movimientos',
      operacion: 'INSERT',
      registro_id: String(movimientoId),
      datos_nuevos: { id: movimientoId, items: detalleRows, ubicacion_destino_id: destinoId },
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    transactionStarted = false;

    let pdf = { available: false, code: 'PDF_GENERATION_FAILED' };
    try {
      const pdfResult = await generateMovimientoPdf(movimientoId);
      if (pdfResult) {
        await db.query('UPDATE movimientos SET pdf_path = $1 WHERE id = $2', [
          pdfResult.relativePath,
          movimientoId,
        ]);
        pdf = { available: true, path: pdfResult.relativePath };
      } else {
        pdf = { available: false, code: 'MOVEMENT_PDF_NOT_AVAILABLE' };
      }
    } catch (pdfError) {
      logControllerError('Error al generar PDF después de crear movimiento:', pdfError);
    }

    res.status(201).json({
      success: true,
      message: pdf.available
        ? 'Movimiento registrado exitosamente'
        : 'Movimiento registrado exitosamente, pero el PDF no está disponible',
      data: {
        id: movimientoId,
        pdf_path: pdf.available ? pdf.path : null,
      },
      pdf,
    });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logControllerError('Error al hacer rollback de createMovimiento:', rollbackError);
      }
    }

    sendInventoryError(res, error, 'Error al crear movimiento:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const anularMovimiento = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del movimiento es inválido');
    const motivo = validateDetailedReason(req.body?.motivo, 'motivo de anulación');

    client = await db.getClient();
    await client.query('BEGIN');

    const movimientoRes = await client.query('SELECT * FROM movimientos WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    if (movimientoRes.rowCount === 0) {
      throw createHttpError(404, 'Movimiento no encontrado');
    }

    const movimiento = movimientoRes.rows[0];
    if (movimiento.estado === 'ANULADO') {
      throw createAppError(409, 'MOVEMENT_ALREADY_VOIDED', 'El movimiento ya está anulado');
    }
    if (movimiento.estado === 'ELIMINADO') {
      throw createAppError(
        409,
        'MOVEMENT_ADMINISTRATIVELY_DELETED',
        'El movimiento fue eliminado administrativamente'
      );
    }
    if (movimiento.reversion_datos_completos !== true) {
      throw createAppError(
        409,
        'MOVEMENT_REVERSAL_DATA_INCOMPLETE',
        'El movimiento no tiene datos completos para reversión automática'
      );
    }

    const effectsRes = await client.query(
      `SELECT *
       FROM inventario_stock_efectos
       WHERE movimiento_id = $1
       ORDER BY articulo_id ASC, id ASC`,
      [id]
    );

    if (effectsRes.rowCount === 0) {
      throw createAppError(
        409,
        'MOVEMENT_REVERSAL_DATA_INCOMPLETE',
        'El movimiento no tiene efectos de stock registrados'
      );
    }

    const lockedArticulos = await lockArticulosByIds(
      client,
      effectsRes.rows.map((effect) => effect.articulo_id)
    );

    for (const effect of effectsRes.rows) {
      const articulo = lockedArticulos.get(Number(effect.articulo_id));
      await applyInverseStockEffect(client, effect, articulo, 'CANNOT_VOID_INSUFFICIENT_STOCK');
    }

    const updateRes = await client.query(
      `UPDATE movimientos
       SET estado = 'ANULADO',
           anulado_por = $2,
           anulado_en = CURRENT_TIMESTAMP,
           motivo_anulacion = $3
       WHERE id = $1
       RETURNING id, estado, anulado_por, anulado_en, motivo_anulacion`,
      [id, req.user?.id || null, motivo]
    );

    await logAuditStrict(client, {
      tabla: 'movimientos',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: movimiento,
      datos_nuevos: updateRes.rows[0],
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Movimiento anulado exitosamente',
      data: updateRes.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    sendInventoryError(res, error, 'Error al anular movimiento:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const anularBajaArticulo = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id de la baja es inválido');
    const motivo = validateDetailedReason(req.body?.motivo, 'motivo de anulación');

    client = await db.getClient();
    await client.query('BEGIN');

    const bajaRes = await client.query('SELECT * FROM articulos_bajas WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    if (bajaRes.rowCount === 0) {
      throw createHttpError(404, 'Baja no encontrada');
    }

    const baja = bajaRes.rows[0];
    if (baja.estado === 'ANULADO') {
      throw createAppError(409, 'BAJA_ALREADY_VOIDED', 'La baja ya está anulada');
    }
    if (baja.estado === 'ELIMINADO') {
      throw createAppError(
        409,
        'BAJA_ADMINISTRATIVELY_DELETED',
        'La baja fue eliminada administrativamente'
      );
    }
    if (baja.reversion_datos_completos !== true) {
      throw createAppError(
        409,
        'BAJA_REVERSAL_DATA_INCOMPLETE',
        'La baja no tiene datos completos para reversión automática'
      );
    }

    const effectsRes = await client.query(
      `SELECT *
       FROM inventario_stock_efectos
       WHERE baja_id = $1
       ORDER BY articulo_id ASC, id ASC`,
      [id]
    );

    if (effectsRes.rowCount === 0) {
      throw createAppError(
        409,
        'BAJA_REVERSAL_DATA_INCOMPLETE',
        'La baja no tiene efectos de stock registrados'
      );
    }

    const lockedArticulos = await lockArticulosByIds(
      client,
      effectsRes.rows.map((effect) => effect.articulo_id)
    );

    for (const effect of effectsRes.rows) {
      const articulo = lockedArticulos.get(Number(effect.articulo_id));
      await applyInverseStockEffect(client, effect, articulo, 'BAJA_REVERSAL_DATA_INCOMPLETE');
    }

    const updateRes = await client.query(
      `UPDATE articulos_bajas
       SET estado = 'ANULADO',
           anulado_por = $2,
           anulado_en = CURRENT_TIMESTAMP,
           motivo_anulacion = $3
       WHERE id = $1
       RETURNING id, estado, anulado_por, anulado_en, motivo_anulacion`,
      [id, req.user?.id || null, motivo]
    );

    await logAuditStrict(client, {
      tabla: 'articulos_bajas',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: baja,
      datos_nuevos: updateRes.rows[0],
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Baja anulada exitosamente',
      data: updateRes.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    sendInventoryError(res, error, 'Error al anular baja:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const deleteMovimientoAdministrativo = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del movimiento es inválido');
    const motivo = validateDetailedReason(req.body?.motivo, 'motivo de eliminación');

    client = await db.getClient();
    await client.query('BEGIN');

    const movimientoRes = await client.query('SELECT * FROM movimientos WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    if (movimientoRes.rowCount === 0) {
      throw createHttpError(404, 'Movimiento no encontrado');
    }

    const movimiento = movimientoRes.rows[0];
    if (movimiento.estado === 'ELIMINADO') {
      throw createAppError(
        409,
        'MOVEMENT_ADMINISTRATIVELY_DELETED',
        'El movimiento ya fue eliminado administrativamente'
      );
    }
    if (movimiento.estado !== 'ANULADO') {
      throw createAppError(
        409,
        'MOVEMENT_MUST_BE_VOIDED_FIRST',
        'El movimiento debe estar anulado antes de eliminarse'
      );
    }

    const updateRes = await client.query(
      `UPDATE movimientos
       SET estado = 'ELIMINADO',
           eliminado_por = $2,
           eliminado_en = CURRENT_TIMESTAMP,
           motivo_eliminacion = $3
       WHERE id = $1
       RETURNING id, estado, eliminado_por, eliminado_en, motivo_eliminacion`,
      [id, req.user?.id || null, motivo]
    );

    await logAuditStrict(client, {
      tabla: 'movimientos',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: movimiento,
      datos_nuevos: updateRes.rows[0],
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Movimiento eliminado administrativamente',
      data: updateRes.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    sendInventoryError(res, error, 'Error al eliminar movimiento:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const deleteBajaAdministrativa = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id de la baja es inválido');
    const motivo = validateDetailedReason(req.body?.motivo, 'motivo de eliminación');

    client = await db.getClient();
    await client.query('BEGIN');

    const bajaRes = await client.query('SELECT * FROM articulos_bajas WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    if (bajaRes.rowCount === 0) {
      throw createHttpError(404, 'Baja no encontrada');
    }

    const baja = bajaRes.rows[0];
    if (baja.estado === 'ELIMINADO') {
      throw createAppError(
        409,
        'BAJA_ADMINISTRATIVELY_DELETED',
        'La baja ya fue eliminada administrativamente'
      );
    }
    if (baja.estado !== 'ANULADO') {
      throw createAppError(
        409,
        'BAJA_MUST_BE_VOIDED_FIRST',
        'La baja debe estar anulada antes de eliminarse'
      );
    }

    const updateRes = await client.query(
      `UPDATE articulos_bajas
       SET estado = 'ELIMINADO',
           eliminado_por = $2,
           eliminado_en = CURRENT_TIMESTAMP,
           motivo_eliminacion = $3
       WHERE id = $1
       RETURNING id, estado, eliminado_por, eliminado_en, motivo_eliminacion`,
      [id, req.user?.id || null, motivo]
    );

    await logAuditStrict(client, {
      tabla: 'articulos_bajas',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_anteriores: baja,
      datos_nuevos: updateRes.rows[0],
      ...auditFromReq(req),
    });

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Baja eliminada administrativamente',
      data: updateRes.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    sendInventoryError(res, error, 'Error al eliminar baja:');
  } finally {
    if (client) {
      client.release();
    }
  }
};

const downloadMovimientoPdf = async (req, res) => {
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del movimiento es inválido');
    const result = await db.query('SELECT pdf_path FROM movimientos WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado',
      });
    }

    const fullPath = movementPdfStorage.resolveReference(result.rows[0].pdf_path);

    if (!fullPath || !movementPdfStorage.exists(result.rows[0].pdf_path)) {
      return res.status(409).json({
        success: false,
        code: 'MOVEMENT_PDF_NOT_AVAILABLE',
        message: 'PDF del movimiento no disponible',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=movimiento-${id}.pdf`);
    return res.sendFile(fullPath);
  } catch (error) {
    logControllerError('Error al descargar PDF:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error en el servidor',
    });
  }
};

const regenerateMovimientoPdf = async (req, res) => {
  let client;
  try {
    const id = parsePositiveInteger(req.params.id, 'El id del movimiento es inválido');
    const result = await db.query('SELECT id FROM movimientos WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado',
      });
    }

    const pdfResult = await generateMovimientoPdf(id);
    if (!pdfResult) {
      return res.status(409).json({
        success: false,
        code: 'MOVEMENT_PDF_NOT_AVAILABLE',
        message: 'PDF del movimiento no disponible',
      });
    }

    client = await db.getClient();
    await client.query('BEGIN');
    await client.query('UPDATE movimientos SET pdf_path = $1 WHERE id = $2', [
      pdfResult.relativePath,
      id,
    ]);
    await logAuditStrict(client, {
      tabla: 'movimientos',
      operacion: 'UPDATE',
      registro_id: String(id),
      datos_nuevos: { pdf_path: pdfResult.relativePath, pdf_regenerado: true },
      ...auditFromReq(req),
    });
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'PDF del movimiento regenerado exitosamente',
      data: {
        id,
        pdf_path: pdfResult.relativePath,
      },
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logControllerError('Error al regenerar PDF:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error en el servidor',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  getUbicaciones,
  getArticulos,
  getArticulosCatalogo,
  createArticulo,
  updateArticulo,
  deleteArticulo,
  getBajasArticulos,
  darBajaArticulo,
  getMovimientos,
  createMovimiento,
  anularMovimiento,
  anularBajaArticulo,
  deleteMovimientoAdministrativo,
  deleteBajaAdministrativa,
  downloadMovimientoPdf,
  regenerateMovimientoPdf,
  exportArticulosExcel,
  exportBajasArticulosExcel,
  exportMovimientosExcel,
};
