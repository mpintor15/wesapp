const db = require('../config/database');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const { isValidDateString } = require('../utils/inputValidation');
const {
  findActiveBlocksForLocation,
  findActivePrincipalResidentForVilla,
  findActiveVisitFormForLocation,
  findVisitForms,
  findVisitFormCreators,
  findActiveVillasForBlock,
  findHistory,
  findLockedBlock,
  findLockedVisit,
  findLockedUserLocationAssignment,
  findLockedVilla,
  findVisits,
  findVisitCreators,
  findVisibleBlock,
  findVisibleLocation,
  findVisibleLocations,
  insertBitacoraRegistro,
  insertVisitResponses,
  publishVisitFormForLocation,
  acquireVisitFormPublishLock,
  findLockedVisitFormVersion,
  archiveVisitFormVersion,
  createVisit,
  closeVisit,
  cancelVisit,
} = require('../repositories/bitacorasRepository');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');

const BITACORA_STATES = new Set(['REGISTRADA', 'ANULADA']);
const URBAN_CONTEXT_CONSTRAINTS = new Set([
  'bitacora_registros_villa_requiere_manzana_check',
  'bitacora_registros_manzana_ubicacion_fkey',
  'bitacora_registros_villa_manzana_fkey',
]);
const HISTORY_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'ubicacion_id',
  'fecha_desde',
  'fecha_hasta',
  'estado',
  'autor',
]);
const VISIT_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'estado',
  'creator',
  'fecha_desde',
  'fecha_hasta',
  'search',
]);
const VISIT_STATES = new Set(['ABIERTA', 'CERRADA', 'ANULADA']);
const VISIT_FORM_STATES = new Set(['ACTIVE', 'ARCHIVED']);
const VISIT_FORM_QUERY_FIELDS = new Set([
  'page',
  'pageSize',
  'nombre',
  'ubicacion_id',
  'creator',
  'estado',
]);
const EXPORT_PAGE = { page: 1, pageSize: 100000, offset: 0 };

const hasGlobalLocationScope = (tipoUsuario) =>
  hasPermission(tipoUsuario, PERMISSIONS.BITACORAS_PUNTOS_VER_TODOS);

const domainError = (status, code, message) => {
  const error = createHttpError(status, message);
  error.appCode = code;
  return error;
};

const getCurrentUserScope = async (userId, executor = db) => {
  const result = await executor.query(
    `SELECT id, tipo_usuario, activo
     FROM usuarios
     WHERE id = $1`,
    [userId]
  );
  if (result.rowCount === 0 || !result.rows[0].activo) {
    throw createHttpError(403, 'El Usuario autenticado no está disponible');
  }
  return {
    userId: result.rows[0].id,
    hasGlobalScope: hasGlobalLocationScope(result.rows[0].tipo_usuario),
  };
};

const getCurrentActor = async (userId, client) => {
  const userResult = await client.query(
    `SELECT id, usuario, tipo_usuario, colaborador_id, activo
     FROM usuarios
     WHERE id = $1
     FOR SHARE`,
    [userId]
  );
  if (userResult.rowCount === 0 || !userResult.rows[0].activo) {
    throw createHttpError(403, 'El Usuario autenticado no está disponible');
  }
  const actor = userResult.rows[0];
  if (!actor.colaborador_id) {
    throw createHttpError(409, 'El Usuario autenticado no tiene un Colaborador asociado');
  }
  const collaboratorResult = await client.query(
    `SELECT id
     FROM colaboradores
     WHERE id = $1
     FOR SHARE`,
    [actor.colaborador_id]
  );
  if (collaboratorResult.rowCount === 0) {
    throw createHttpError(409, 'El Colaborador asociado al Usuario no existe');
  }
  return {
    ...actor,
    hasGlobalScope: hasGlobalLocationScope(actor.tipo_usuario),
  };
};

const normalizeHistoryFilters = (query = {}) => {
  const unknownFields = Object.keys(query).filter((field) => !HISTORY_QUERY_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw createHttpError(400, `Filtro no permitido: ${unknownFields[0]}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const ubicacionId = query.ubicacion_id
    ? parsePositiveInteger(query.ubicacion_id, 'El filtro ubicación es inválido')
    : undefined;
  const fechaDesde = query.fecha_desde || undefined;
  const fechaHasta = query.fecha_hasta || undefined;
  const estado = query.estado || undefined;
  if (query.autor !== undefined && typeof query.autor !== 'string') {
    throw createHttpError(400, 'autor debe ser texto');
  }
  const autor = query.autor?.trim() || undefined;

  if (fechaDesde && !isValidDateString(fechaDesde)) {
    throw createHttpError(400, 'fecha_desde debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaHasta && !isValidDateString(fechaHasta)) {
    throw createHttpError(400, 'fecha_hasta debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw createHttpError(400, 'El rango de fechas es inválido');
  }
  if (estado && !BITACORA_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser REGISTRADA o ANULADA');
  }
  if (autor && autor.length > 100) {
    throw createHttpError(400, 'autor no puede exceder 100 caracteres');
  }

  return { ubicacionId, fechaDesde, fechaHasta, estado, autor };
};

const normalizeVisitFilters = (query = {}) => {
  const unknownFields = Object.keys(query).filter((field) => !VISIT_QUERY_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw createHttpError(400, `Filtro no permitido: ${unknownFields[0]}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const estado = query.estado || undefined;
  if (estado && !VISIT_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser ABIERTA, CERRADA o ANULADA');
  }
  const fechaDesde = query.fecha_desde || undefined;
  const fechaHasta = query.fecha_hasta || undefined;
  if (fechaDesde && !isValidDateString(fechaDesde)) {
    throw createHttpError(400, 'fecha_desde debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaHasta && !isValidDateString(fechaHasta)) {
    throw createHttpError(400, 'fecha_hasta debe tener formato YYYY-MM-DD y ser real');
  }
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw createHttpError(400, 'El rango de fechas es inválido');
  }
  const textFilter = (value, field) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw createHttpError(400, `${field} debe ser texto`);
    }
    const trimmed = value.trim();
    if (trimmed.length > 100) {
      throw createHttpError(400, `${field} no puede exceder 100 caracteres`);
    }
    return trimmed || undefined;
  };
  return {
    estado,
    fechaDesde,
    fechaHasta,
    creator: textFilter(query.creator, 'creator'),
    search: textFilter(query.search, 'search'),
  };
};

const normalizeVisitFormFilters = (query = {}) => {
  const unknownField = Object.keys(query).find((field) => !VISIT_FORM_QUERY_FIELDS.has(field));
  if (unknownField) {
    throw createHttpError(400, `Filtro no permitido: ${unknownField}`);
  }
  const repeatedField = Object.entries(query).find(([, value]) => Array.isArray(value));
  if (repeatedField) {
    throw createHttpError(400, `El filtro ${repeatedField[0]} no puede repetirse`);
  }
  const normalizeTextFilter = (value, field) => {
    const normalized = value?.trim() || undefined;
    if (normalized && normalized.length > 100) {
      throw createHttpError(400, `${field} no puede exceder 100 caracteres`);
    }
    return normalized;
  };
  const locationId = query.ubicacion_id
    ? parsePositiveInteger(query.ubicacion_id, 'La Urbanización es inválida')
    : undefined;
  const estado = query.estado || undefined;
  if (estado && !VISIT_FORM_STATES.has(estado)) {
    throw createHttpError(400, 'estado debe ser ACTIVE o ARCHIVED');
  }
  return {
    nombre: normalizeTextFilter(query.nombre, 'nombre'),
    creator: normalizeTextFilter(query.creator, 'creator'),
    locationId,
    estado,
  };
};

const addRowsAndSend = async ({ rows, sheetName, columns, filename, res }) => {
  const { workbook, worksheet } = createWorkbook(sheetName, columns);
  rows.forEach((row) => worksheet.addRow(row));
  styleDataRows(worksheet);
  await sendExcel(workbook, res, filename);
};

const assertLocationScope = async ({
  client,
  userId,
  locationId,
  hasGlobalScope,
  concealUnauthorized = false,
}) => {
  const locationResult = await client.query(
    `SELECT id, nombre, cliente_id, tipo_punto
     FROM ubicaciones
     WHERE id = $1
     FOR SHARE`,
    [locationId]
  );
  if (locationResult.rowCount === 0) {
    throw createHttpError(404, 'Ubicación no encontrada');
  }

  if (!hasGlobalScope) {
    const assignment = await findLockedUserLocationAssignment({ client, userId, locationId });
    if (!assignment) {
      if (concealUnauthorized) {
        throw domainError(404, 'LOCATION_NOT_FOUND', 'Ubicación no encontrada');
      }
      throw createHttpError(403, 'No tienes acceso a la Ubicación seleccionada');
    }
  }

  return locationResult.rows[0];
};

const assertUrbanContext = async ({ client, location, blockId, villaId }) => {
  const hasBlock = blockId !== null && blockId !== undefined;
  const hasVilla = villaId !== null && villaId !== undefined;

  if (location.tipo_punto !== 'URBANIZACION') {
    if (hasBlock || hasVilla) {
      throw domainError(409, 'URBAN_CONTEXT_NOT_ALLOWED', 'La Ubicación no admite contexto urbano');
    }
    return;
  }

  if (!hasBlock || !hasVilla) {
    throw domainError(400, 'COMPLETE_HOUSE_REQUIRED', 'Selecciona Manzana y Villa para la Casa');
  }

  const block = await findLockedBlock({ client, blockId });
  if (!block) {
    throw domainError(404, 'BLOCK_NOT_FOUND', 'Manzana no encontrada');
  }
  if (block.estado !== 'activo') {
    throw domainError(409, 'BLOCK_INACTIVE', 'La Manzana seleccionada está inactiva');
  }
  if (block.ubicacion_id !== location.id) {
    throw domainError(409, 'INVALID_URBAN_CHAIN', 'La Manzana no pertenece a la Ubicación');
  }

  const villa = await findLockedVilla({ client, villaId });
  if (!villa) {
    throw domainError(404, 'VILLA_NOT_FOUND', 'Villa no encontrada');
  }
  if (villa.estado !== 'activo') {
    throw domainError(409, 'VILLA_INACTIVE', 'La Villa seleccionada está inactiva');
  }
  if (villa.manzana_id !== block.id) {
    throw domainError(409, 'INVALID_URBAN_CHAIN', 'La Villa no pertenece a la Manzana');
  }

  const principalResident = await findActivePrincipalResidentForVilla({ client, villaId });
  if (!principalResident) {
    throw domainError(409, 'VILLA_WITHOUT_ACTIVE_RESIDENT', 'La Villa no tiene titular activo');
  }
  return { block, villa, principalResident };
};

const validateVisitResponses = (fields, responses = {}, tipoVisitaId) => {
  const allowedKeys = new Set(fields.map((field) => field.field_key));
  const unknownKey = Object.keys(responses).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    const error = domainError(
      400,
      'VISIT_RESPONSE_FIELD_NOT_ALLOWED',
      'Campo de visita no permitido'
    );
    error.details = { respuestas: [`Campo no permitido: ${unknownKey}`] };
    throw error;
  }

  const normalized = {};
  fields.forEach((field) => {
    const rawValue = responses[field.field_key];
    const applies =
      !field.aplica_a ||
      field.aplica_a === 'TODOS' ||
      (Array.isArray(field.tipos) && field.tipos.includes(tipoVisitaId));
    if (!applies) {
      if (rawValue !== undefined) {
        const error = domainError(
          400,
          'VISIT_RESPONSE_NOT_APPLICABLE',
          `${field.label} no aplica al tipo de ingreso`
        );
        error.details = { [`respuestas.${field.field_key}`]: [error.message] };
        throw error;
      }
      return;
    }
    const missing = rawValue === undefined || rawValue === null || rawValue === '';
    if (field.required && (missing || (field.type === 'checkbox' && rawValue !== true))) {
      const error = domainError(400, 'VISIT_RESPONSE_REQUIRED', `${field.label} es requerido`);
      error.details = { [`respuestas.${field.field_key}`]: [error.message] };
      throw error;
    }
    if (missing) {
      return;
    }

    if (field.type === 'checkbox') {
      if (typeof rawValue !== 'boolean') {
        const error = domainError(400, 'VISIT_RESPONSE_INVALID', `${field.label} debe ser sí/no`);
        error.details = { [`respuestas.${field.field_key}`]: [error.message] };
        throw error;
      }
      normalized[field.field_key] = rawValue;
      return;
    }
    const stringValue = String(rawValue).trim();
    if (!stringValue && field.required) {
      const error = domainError(400, 'VISIT_RESPONSE_REQUIRED', `${field.label} es requerido`);
      error.details = { [`respuestas.${field.field_key}`]: [error.message] };
      throw error;
    }
    if (!stringValue) {
      return;
    }
    if (field.type === 'number' && !Number.isFinite(Number(stringValue))) {
      const error = domainError(400, 'VISIT_RESPONSE_INVALID', `${field.label} debe ser numérico`);
      error.details = { [`respuestas.${field.field_key}`]: [error.message] };
      throw error;
    }
    if (
      field.type === 'cedula' &&
      (typeof rawValue !== 'string' || !/^\d{10}$/.test(stringValue))
    ) {
      const error = domainError(
        400,
        'VISIT_RESPONSE_INVALID',
        `${field.label} debe tener 10 dígitos`
      );
      error.details = { [`respuestas.${field.field_key}`]: [error.message] };
      throw error;
    }
    const normalizedPlate =
      field.type === 'placa' && typeof rawValue === 'string'
        ? stringValue.toUpperCase().replace(/[^A-Z0-9]/g, '')
        : stringValue;
    if (
      field.type === 'placa' &&
      (typeof rawValue !== 'string' || !/^[A-Z0-9]{5,10}$/.test(normalizedPlate))
    ) {
      const error = domainError(
        400,
        'VISIT_RESPONSE_INVALID',
        `${field.label} debe tener entre 5 y 10 letras o números`
      );
      error.details = { [`respuestas.${field.field_key}`]: [error.message] };
      throw error;
    }
    if (field.type === 'select') {
      const options = Array.isArray(field.options) ? field.options : [];
      if (!options.includes(stringValue)) {
        const error = domainError(
          400,
          'VISIT_RESPONSE_INVALID',
          `${field.label} no es una opción válida`
        );
        error.details = { [`respuestas.${field.field_key}`]: [error.message] };
        throw error;
      }
    }
    normalized[field.field_key] =
      field.type === 'number'
        ? Number(stringValue)
        : field.type === 'placa'
          ? normalizedPlate
          : stringValue;
  });
  return normalized;
};

const visitDetail = ({ action, visitorName, tipoVisitaNombre, plate, house }) => {
  const access = plate ? `${tipoVisitaNombre} · Placa ${plate}` : tipoVisitaNombre;
  return `${action} visita: ${visitorName} · ${access} · Casa ${house}`;
};

const createRegistro = async (req, res) => {
  try {
    const created = await db.transaction(async (client) => {
      const userResult = await client.query(
        `SELECT id, usuario, tipo_usuario, colaborador_id, activo
         FROM usuarios
         WHERE id = $1
         FOR SHARE`,
        [req.user.id]
      );
      if (userResult.rowCount === 0 || !userResult.rows[0].activo) {
        throw createHttpError(403, 'El Usuario autenticado no está disponible');
      }
      const actor = userResult.rows[0];
      const hasGlobalScope = hasGlobalLocationScope(actor.tipo_usuario);
      if (!actor.colaborador_id) {
        throw createHttpError(409, 'El Usuario autenticado no tiene un Colaborador asociado');
      }

      const collaboratorResult = await client.query(
        `SELECT id
         FROM colaboradores
         WHERE id = $1
         FOR SHARE`,
        [actor.colaborador_id]
      );
      if (collaboratorResult.rowCount === 0) {
        throw createHttpError(409, 'El Colaborador asociado al Usuario no existe');
      }

      const location = await assertLocationScope({
        client,
        userId: actor.id,
        locationId: req.body.ubicacion_id,
        hasGlobalScope,
      });

      await assertUrbanContext({
        client,
        location,
        blockId: req.body.manzana_id ?? null,
        villaId: req.body.villa_id ?? null,
      });

      const result = await client.query(
        `INSERT INTO bitacora_registros
          (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
           ocurrido_at, detalle)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
                   ocurrido_at, detalle, estado, created_at`,
        [
          req.body.ubicacion_id,
          req.body.manzana_id ?? null,
          req.body.villa_id ?? null,
          actor.id,
          actor.colaborador_id,
          req.body.ocurrido_at,
          req.body.detalle,
        ]
      );
      const registro = result.rows[0];

      await logAuditStrict(client, {
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: registro.id,
        datos_nuevos: registro,
        ...auditFromReq(req),
      });

      return registro;
    });

    return res.status(201).json({
      success: true,
      message: 'Registro de Bitácora creado exitosamente',
      data: created,
    });
  } catch (error) {
    if (URBAN_CONTEXT_CONSTRAINTS.has(error.constraint)) {
      error.status = 409;
      error.appCode = 'INVALID_URBAN_CHAIN';
      error.message = 'El contexto urbano dejó de ser válido';
    }
    return handleControllerError(res, error, 'Error al crear registro de Bitácora');
  }
};

const getManzanasElegibles = async (req, res) => {
  try {
    const locationId = parsePositiveInteger(req.params.ubicacionId, 'La Ubicación es inválida');
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const visibleLocation = await findVisibleLocation({ locationId, hasGlobalScope, userId });
    if (!visibleLocation) {
      throw domainError(404, 'LOCATION_NOT_FOUND', 'Ubicación no encontrada');
    }
    const data = await db.transaction(async (client) => {
      const location = await assertLocationScope({
        client,
        userId,
        locationId,
        hasGlobalScope,
        concealUnauthorized: true,
      });
      return location.tipo_punto === 'URBANIZACION'
        ? findActiveBlocksForLocation({ locationId, executor: client })
        : [];
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar Manzanas de Bitácora');
  }
};

const getVillasElegibles = async (req, res) => {
  try {
    const blockId = parsePositiveInteger(req.params.manzanaId, 'La Manzana es inválida');
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const existingBlock = await findVisibleBlock({ blockId, hasGlobalScope, userId });
    if (!existingBlock) {
      throw domainError(404, 'BLOCK_NOT_FOUND', 'Manzana no encontrada');
    }
    const data = await db.transaction(async (client) => {
      const location = await assertLocationScope({
        client,
        userId,
        locationId: existingBlock.ubicacion_id,
        hasGlobalScope,
        concealUnauthorized: true,
      });
      const block = await findLockedBlock({ client, blockId });
      if (!block || block.ubicacion_id !== location.id) {
        throw domainError(409, 'INVALID_URBAN_CHAIN', 'La Manzana dejó de estar disponible');
      }
      if (location.tipo_punto !== 'URBANIZACION' || block.estado !== 'activo') {
        throw domainError(409, 'BLOCK_INACTIVE', 'La Manzana no está disponible');
      }
      return findActiveVillasForBlock({ blockId, executor: client });
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar Villas de Bitácora');
  }
};

const getRegistros = async (req, res) => {
  try {
    const pagination = normalizePaginationQuery(req.query);
    const filters = normalizeHistoryFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);

    if (filters.ubicacionId && !hasGlobalScope) {
      const scopeResult = await db.query(
        `SELECT 1
         FROM usuario_ubicaciones
         WHERE usuario_id = $1 AND ubicacion_id = $2`,
        [userId, filters.ubicacionId]
      );
      if (scopeResult.rowCount === 0) {
        throw createHttpError(403, 'No tienes acceso a la Ubicación seleccionada');
      }
    }

    const { items, total } = await findHistory({
      filters,
      hasGlobalScope,
      userId,
      pagination,
    });
    const meta = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: total,
    });

    return res.json({ success: true, data: items, meta });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar historial de Bitácora');
  }
};

const getUbicacionesVisibles = async (req, res) => {
  try {
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const data = await findVisibleLocations({
      hasGlobalScope,
      userId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar Ubicaciones de Bitácora');
  }
};

const getActiveVisitForm = async (req, res) => {
  try {
    const locationId = parsePositiveInteger(req.params.ubicacionId, 'La Ubicación es inválida');
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const location = await findVisibleLocation({ locationId, hasGlobalScope, userId });
    if (!location) {
      throw domainError(404, 'LOCATION_NOT_FOUND', 'Ubicación no encontrada');
    }
    if (location.tipo_punto !== 'URBANIZACION') {
      throw domainError(
        409,
        'VISIT_FORM_NOT_ALLOWED',
        'La Ubicación no admite formulario de visitas'
      );
    }
    const form = await findActiveVisitFormForLocation({ locationId });
    if (!form) {
      throw domainError(404, 'ACTIVE_VISIT_FORM_NOT_FOUND', 'No hay formulario activo');
    }
    return res.json({ success: true, data: form });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar formulario de visitas');
  }
};

const getVisitForms = async (req, res) => {
  try {
    const pagination = normalizePaginationQuery(req.query);
    const filters = normalizeVisitFormFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const [{ items, total }, creators] = await Promise.all([
      findVisitForms({ hasGlobalScope, userId, filters, pagination }),
      findVisitFormCreators({ hasGlobalScope, userId }),
    ]);
    const meta = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: total,
    });
    return res.json({ success: true, data: items, meta, filters: { creators } });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar formularios de visitas');
  }
};

const exportRegistros = async (req, res) => {
  try {
    const filters = normalizeHistoryFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const { items } = await findHistory({
      filters,
      hasGlobalScope,
      userId,
      pagination: EXPORT_PAGE,
    });
    await addRowsAndSend({
      rows: items.map((item) => ({
        fecha: item.ocurrido_at,
        ubicacion: item.ubicacion_nombre,
        casa:
          item.manzana_nombre && item.villa_identificador
            ? `${item.manzana_nombre} - ${item.villa_identificador}`
            : '',
        autor: item.autor_colaborador_nombre || item.autor_usuario,
        detalle: item.detalle,
        estado: item.estado,
      })),
      sheetName: 'Bitácoras',
      columns: [
        { header: 'Fecha/hora', key: 'fecha', width: 22 },
        { header: 'Ubicación', key: 'ubicacion', width: 28 },
        { header: 'Casa', key: 'casa', width: 18 },
        { header: 'Autor', key: 'autor', width: 28 },
        { header: 'Detalle', key: 'detalle', width: 55 },
        { header: 'Estado', key: 'estado', width: 15 },
      ],
      filename: 'reporte_bitacoras.xlsx',
      res,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar Bitácoras');
  }
};

const exportVisitas = async (req, res) => {
  try {
    const filters = normalizeVisitFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const { items } = await findVisits({
      filters,
      hasGlobalScope,
      userId,
      pagination: EXPORT_PAGE,
    });
    await addRowsAndSend({
      rows: items.map((item) => ({
        entrada: item.entrada_at,
        salida: item.salida_at,
        visitante: item.visitante_nombre,
        cedula: item.visitante_documento,
        tipo: item.tipo_visita_nombre,
        placa: item.placa || '',
        ubicacion: item.ubicacion_nombre,
        casa: `${item.manzana_nombre} - ${item.villa_identificador}`,
        titular: item.residente_principal_nombre,
        creador: item.registrado_por_colaborador_nombre || item.registrado_por_usuario,
        estado: item.estado,
      })),
      sheetName: 'Visitas',
      columns: [
        { header: 'Ingreso', key: 'entrada', width: 22 },
        { header: 'Salida', key: 'salida', width: 22 },
        { header: 'Visitante', key: 'visitante', width: 28 },
        { header: 'Cédula', key: 'cedula', width: 15 },
        { header: 'Tipo', key: 'tipo', width: 14 },
        { header: 'Placa', key: 'placa', width: 14 },
        { header: 'Urbanización', key: 'ubicacion', width: 28 },
        { header: 'Casa', key: 'casa', width: 16 },
        { header: 'Titular', key: 'titular', width: 28 },
        { header: 'Creador', key: 'creador', width: 28 },
        { header: 'Estado', key: 'estado', width: 14 },
      ],
      filename: 'reporte_visitas.xlsx',
      res,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar Visitas');
  }
};

const exportVisitForms = async (req, res) => {
  try {
    const filters = normalizeVisitFormFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const { items } = await findVisitForms({
      filters,
      hasGlobalScope,
      userId,
      pagination: EXPORT_PAGE,
    });
    await addRowsAndSend({
      rows: items.map((item) => ({
        nombre: item.titulo,
        ubicacion: item.ubicacion_nombre,
        version: item.version,
        estado: item.estado,
        creador: item.creador,
        publicado: item.published_at,
      })),
      sheetName: 'Formularios',
      columns: [
        { header: 'Nombre', key: 'nombre', width: 32 },
        { header: 'Urbanización', key: 'ubicacion', width: 28 },
        { header: 'Versión', key: 'version', width: 12 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Creador', key: 'creador', width: 24 },
        { header: 'Publicado', key: 'publicado', width: 22 },
      ],
      filename: 'reporte_formularios_visitas.xlsx',
      res,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al exportar Formularios');
  }
};

const publishVisitForm = async (req, res) => {
  try {
    const locationId = parsePositiveInteger(req.params.ubicacionId, 'La Ubicación es inválida');
    const published = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      const location = await assertLocationScope({
        client,
        userId: actor.id,
        locationId,
        hasGlobalScope: actor.hasGlobalScope,
      });
      if (location.tipo_punto !== 'URBANIZACION') {
        throw domainError(
          409,
          'VISIT_FORM_NOT_ALLOWED',
          'La Ubicación no admite formulario de visitas'
        );
      }
      await acquireVisitFormPublishLock({ client, locationId });
      const existingActive = await findActiveVisitFormForLocation({
        locationId,
        executor: client,
      });
      if (
        existingActive &&
        !hasPermission(actor.tipo_usuario, PERMISSIONS.BITACORAS_FORMULARIOS_GESTIONAR)
      ) {
        throw createHttpError(
          403,
          'Solo Gerente o Supervisor pueden editar un formulario ya publicado'
        );
      }
      const form = await publishVisitFormForLocation({
        client,
        locationId,
        title: req.body.titulo,
        showDateTime: req.body.mostrar_fecha_hora,
        tiposVisita: req.body.tipos_visita,
        fields: req.body.fields || [],
        userId: actor.id,
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_visit_form_versions',
        operacion: 'INSERT',
        registro_id: form.id,
        datos_nuevos: form,
        ...auditFromReq(req),
      });
      return form;
    });
    return res.status(201).json({
      success: true,
      message: 'Formulario de visitas publicado',
      data: published,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al publicar formulario de visitas');
  }
};

const archiveVisitForm = async (req, res) => {
  try {
    const formId = parsePositiveInteger(req.params.formId, 'El formulario es inválido');
    const archived = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      const form = await findLockedVisitFormVersion({ client, formId });
      if (!form) {
        throw domainError(404, 'VISIT_FORM_NOT_FOUND', 'Formulario no encontrado');
      }
      await assertLocationScope({
        client,
        userId: actor.id,
        locationId: form.ubicacion_id,
        hasGlobalScope: actor.hasGlobalScope,
        concealUnauthorized: true,
      });
      if (form.estado !== 'ACTIVE') {
        throw domainError(
          409,
          'VISIT_FORM_NOT_ACTIVE',
          'Solo se puede cambiar el estado de un formulario activo'
        );
      }
      const updated = await archiveVisitFormVersion({ client, formId });
      await logAuditStrict(client, {
        tabla: 'bitacora_visit_form_versions',
        operacion: 'UPDATE',
        registro_id: updated.id,
        datos_anteriores: form,
        datos_nuevos: updated,
        ...auditFromReq(req),
      });
      return updated;
    });
    return res.json({
      success: true,
      message: 'Formulario archivado',
      data: archived,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al cambiar el estado del formulario');
  }
};

const createVisita = async (req, res) => {
  try {
    const created = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      const location = await assertLocationScope({
        client,
        userId: actor.id,
        locationId: req.body.ubicacion_id,
        hasGlobalScope: actor.hasGlobalScope,
      });
      if (location.tipo_punto !== 'URBANIZACION') {
        throw domainError(
          409,
          'VISIT_NOT_ALLOWED',
          'Solo se registran visitas para Urbanizaciones'
        );
      }
      const urban = await assertUrbanContext({
        client,
        location,
        blockId: req.body.manzana_id,
        villaId: req.body.villa_id,
      });
      const form = await findActiveVisitFormForLocation({
        locationId: location.id,
        executor: client,
      });
      if (!form) {
        throw domainError(
          409,
          'ACTIVE_VISIT_FORM_REQUIRED',
          'La Urbanización no tiene formulario activo'
        );
      }
      const tipoVisita = form.tipos.find((tipo) => tipo.id === req.body.tipo_visita_id);
      if (!tipoVisita) {
        const error = domainError(
          400,
          'VISIT_TYPE_NOT_APPLICABLE',
          'El tipo de visita no pertenece al formulario activo'
        );
        error.details = { tipo_visita_id: [error.message] };
        throw error;
      }
      const responses = validateVisitResponses(
        form.fields,
        req.body.respuestas || {},
        req.body.tipo_visita_id
      );
      const house = `${urban.block.nombre} - ${urban.villa.identificador}`;
      const detail = visitDetail({
        action: 'Ingreso',
        visitorName: req.body.visitante_nombre,
        tipoVisitaNombre: tipoVisita.nombre,
        plate: req.body.placa,
        house,
      });
      const registro = await insertBitacoraRegistro({
        client,
        locationId: location.id,
        blockId: urban.block.id,
        villaId: urban.villa.id,
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        occurredAt: new Date(),
        detail,
      });
      const visita = await createVisit({
        client,
        locationId: location.id,
        blockId: urban.block.id,
        villaId: urban.villa.id,
        principalResidentId: urban.principalResident.id,
        formVersionId: form.id,
        visitor: {
          nombre: req.body.visitante_nombre,
          documento: req.body.visitante_documento,
          telefono: req.body.visitante_telefono,
          tipoVisitaId: req.body.tipo_visita_id,
          placa: req.body.placa || null,
        },
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        entryLogId: registro.id,
      });
      await insertVisitResponses({ client, visitId: visita.id, fields: form.fields, responses });
      await logAuditStrict(client, {
        tabla: 'bitacora_visitas',
        operacion: 'INSERT',
        registro_id: visita.id,
        datos_nuevos: { ...visita, respuestas: responses },
        ...auditFromReq(req),
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: registro.id,
        datos_nuevos: registro,
        ...auditFromReq(req),
      });
      return { ...visita, respuestas: responses };
    });
    return res.status(201).json({
      success: true,
      message: 'Visita registrada',
      data: created,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al registrar visita');
  }
};

const getVisitas = async (req, res) => {
  try {
    const pagination = normalizePaginationQuery(req.query);
    const filters = normalizeVisitFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const [{ items, total }, creators] = await Promise.all([
      findVisits({ filters, hasGlobalScope, userId, pagination }),
      findVisitCreators({ hasGlobalScope, userId }),
    ]);
    const meta = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: total,
    });
    return res.json({ success: true, data: items, meta, filters: { creators } });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar visitas');
  }
};

const closeVisita = async (req, res) => {
  try {
    const visitId = parsePositiveInteger(req.params.visitaId, 'La Visita es inválida');
    const closed = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      const visita = await findLockedVisit({ client, visitId });
      if (!visita) {
        throw domainError(404, 'VISIT_NOT_FOUND', 'Visita no encontrada');
      }
      await assertLocationScope({
        client,
        userId: actor.id,
        locationId: visita.ubicacion_id,
        hasGlobalScope: actor.hasGlobalScope,
        concealUnauthorized: true,
      });
      if (visita.estado !== 'ABIERTA') {
        throw domainError(409, 'VISIT_ALREADY_CLOSED', 'La visita ya no está abierta');
      }
      const detail = visitDetail({
        action: 'Salida',
        visitorName: visita.visitante_nombre,
        tipoVisitaNombre: visita.tipo_visita_nombre,
        plate: visita.placa,
        house: `${visita.manzana_nombre} - ${visita.villa_identificador}`,
      });
      const registro = await insertBitacoraRegistro({
        client,
        locationId: visita.ubicacion_id,
        blockId: visita.manzana_id,
        villaId: visita.villa_id,
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        occurredAt: new Date(),
        detail,
      });
      const updated = await closeVisit({
        client,
        visitId,
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        exitLogId: registro.id,
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_visitas',
        operacion: 'UPDATE',
        registro_id: updated.id,
        datos_anteriores: visita,
        datos_nuevos: updated,
        ...auditFromReq(req),
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: registro.id,
        datos_nuevos: registro,
        ...auditFromReq(req),
      });
      return updated;
    });
    return res.json({ success: true, message: 'Visita cerrada', data: closed });
  } catch (error) {
    return handleControllerError(res, error, 'Error al cerrar visita');
  }
};

const cancelVisita = async (req, res) => {
  try {
    const visitId = parsePositiveInteger(req.params.visitaId, 'La Visita es inválida');
    const cancelled = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      const visita = await findLockedVisit({ client, visitId });
      if (!visita) {
        throw domainError(404, 'VISIT_NOT_FOUND', 'Visita no encontrada');
      }
      await assertLocationScope({
        client,
        userId: actor.id,
        locationId: visita.ubicacion_id,
        hasGlobalScope: actor.hasGlobalScope,
        concealUnauthorized: true,
      });
      if (visita.estado !== 'ABIERTA') {
        throw domainError(409, 'VISIT_NOT_OPEN', 'Solo se puede anular una visita abierta');
      }
      const detail = visitDetail({
        action: 'Anulación',
        visitorName: visita.visitante_nombre,
        tipoVisitaNombre: visita.tipo_visita_nombre,
        plate: visita.placa,
        house: `${visita.manzana_nombre} - ${visita.villa_identificador}`,
      });
      const registro = await insertBitacoraRegistro({
        client,
        locationId: visita.ubicacion_id,
        blockId: visita.manzana_id,
        villaId: visita.villa_id,
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        occurredAt: new Date(),
        detail,
      });
      const updated = await cancelVisit({
        client,
        visitId,
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        exitLogId: registro.id,
        motivo: req.body.motivo,
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_visitas',
        operacion: 'UPDATE',
        registro_id: updated.id,
        datos_anteriores: visita,
        datos_nuevos: updated,
        ...auditFromReq(req),
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: registro.id,
        datos_nuevos: registro,
        ...auditFromReq(req),
      });
      return updated;
    });
    return res.json({ success: true, message: 'Visita anulada', data: cancelled });
  } catch (error) {
    return handleControllerError(res, error, 'Error al anular visita');
  }
};

module.exports = {
  cancelVisita,
  closeVisita,
  createRegistro,
  createVisita,
  exportRegistros,
  exportVisitas,
  exportVisitForms,
  getActiveVisitForm,
  getVisitForms,
  getRegistros,
  getVisitas,
  getUbicacionesVisibles,
  normalizeHistoryFilters,
  normalizeVisitFilters,
  getCurrentUserScope,
  getManzanasElegibles,
  getVillasElegibles,
  publishVisitForm,
  archiveVisitForm,
};
