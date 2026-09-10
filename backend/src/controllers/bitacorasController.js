const db = require('../config/database');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { logAuditStrict, auditFromReq } = require('../utils/audit');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const { createHttpError, handleControllerError, parsePositiveInteger } = require('../utils/http');
const {
  getBitacorasResumen,
  findActiveVisitFormForLocation,
  findVisitFormVersionDetail,
  hasVisitFormHistory,
  findVisitForms,
  findVisitFormCreators,
  findHistory,
  findHistoryAutores,
  findLockedVisit,
  findLockedUserLocationAssignment,
  findVisits,
  findVisitCreators,
  findVisibleLocation,
  findVisibleLocations,
  insertBitacoraRegistro,
  insertVisitResponses,
  insertVisitGroupResponses,
  publishVisitFormForLocation,
  acquireVisitFormPublishLock,
  findLockedVisitFormVersion,
  archiveVisitFormVersion,
  softDeleteVisitFormVersion,
  createVisit,
  closeVisit,
  cancelVisit,
  userHasLocationAccess,
} = require('../repositories/bitacorasRepository');
const { createWorkbook, styleDataRows, sendExcel } = require('../utils/excel');
const {
  URBAN_CONTEXT_CONSTRAINTS,
  HISTORY_SORTS,
  VISIT_SORTS,
  VISIT_FORM_SORTS,
  hasGlobalLocationScope,
  domainError,
  normalizeHistoryFilters,
  normalizeVisitFilters,
  normalizeVisitFormFilters,
  validateVisitResponses,
  validateVisitGroupResponses,
  visitDetail,
} = require('../modules/bitacoras/bitacoras.domain');

const EXPORT_PAGE = { page: 1, pageSize: 100000, offset: 0 };

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

      // Registro is a free-form internal note: it may target any location
      // (General or Urbanización) but never requires a Casa, unlike Visitas.
      await assertLocationScope({
        client,
        userId: actor.id,
        locationId: req.body.ubicacion_id,
        hasGlobalScope,
      });

      const result = await client.query(
        `INSERT INTO bitacora_registros
          (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
           ocurrido_at, detalle)
         VALUES ($1, NULL, NULL, $2, $3, $4, $5)
         RETURNING id, ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
                   ocurrido_at, detalle, estado, created_at`,
        [
          req.body.ubicacion_id,
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

const getResumen = async (req, res) => {
  try {
    const includeHistorial = hasPermission(
      req.user.tipo_usuario,
      PERMISSIONS.BITACORAS_HISTORIAL_VER
    );
    const includeFormularios = hasPermission(
      req.user.tipo_usuario,
      PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR
    );
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);
    const counts = await getBitacorasResumen({
      hasGlobalScope,
      userId,
      includeHistorial,
      includeFormularios,
    });
    const data = {};
    if (includeHistorial) {
      data.registros = counts.registros;
      data.visitas = counts.visitas;
    }
    if (includeFormularios) {
      data.formularios = counts.formularios;
    }
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar resumen de Bitácoras');
  }
};

const getRegistros = async (req, res) => {
  try {
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'ocurrido_at',
      allowedSorts: HISTORY_SORTS,
    });
    const filters = normalizeHistoryFilters(req.query);
    const { userId, hasGlobalScope } = await getCurrentUserScope(req.user.id);

    if (filters.ubicacionId && !hasGlobalScope) {
      const hasAccess = await userHasLocationAccess(userId, filters.ubicacionId);
      if (!hasAccess) {
        throw createHttpError(403, 'No tienes acceso a la Ubicación seleccionada');
      }
    }

    const [{ items, total }, autores] = await Promise.all([
      findHistory({ filters, hasGlobalScope, userId, pagination }),
      findHistoryAutores({ hasGlobalScope, userId }),
    ]);
    const meta = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: total,
    });

    return res.json({ success: true, data: items, meta, filters: { autores } });
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
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'published_at',
      allowedSorts: VISIT_FORM_SORTS,
    });
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
      const hasHistory = await hasVisitFormHistory({ client, locationId });
      if (
        hasHistory &&
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
        showHouse: req.body.mostrar_casa,
        tiposVisita: req.body.tipos_visita,
        fields: req.body.fields || [],
        groups: req.body.grupos || [],
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

const getVisitFormDetail = async (req, res) => {
  try {
    const formId = parsePositiveInteger(req.params.formId, 'El formulario es inválido');
    const form = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      const detail = await findVisitFormVersionDetail({ formId, executor: client });
      if (!detail) {
        throw domainError(404, 'VISIT_FORM_NOT_FOUND', 'Formulario no encontrado');
      }
      await assertLocationScope({
        client,
        userId: actor.id,
        locationId: detail.ubicacion_id,
        hasGlobalScope: actor.hasGlobalScope,
        concealUnauthorized: true,
      });
      return detail;
    });
    return res.json({ success: true, data: form });
  } catch (error) {
    return handleControllerError(res, error, 'Error al obtener formulario de visitas');
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

const deleteArchivedVisitForm = async (req, res) => {
  try {
    const formId = parsePositiveInteger(req.params.formId, 'El formulario es inválido');
    const deleted = await db.transaction(async (client) => {
      const actor = await getCurrentActor(req.user.id, client);
      if (actor.tipo_usuario !== 'gerente') {
        throw createHttpError(403, 'Solo Gerente puede eliminar formularios archivados');
      }
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
      if (form.estado !== 'ARCHIVED') {
        throw domainError(
          409,
          'VISIT_FORM_NOT_ARCHIVED',
          'Solo se puede eliminar un formulario archivado'
        );
      }
      const updated = await softDeleteVisitFormVersion({ client, formId });
      if (!updated) {
        throw domainError(409, 'VISIT_FORM_DELETE_CONFLICT', 'El formulario ya no está disponible');
      }
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
    return res.json({ success: true, message: 'Formulario eliminado', data: deleted });
  } catch (error) {
    return handleControllerError(res, error, 'Error al eliminar formulario de visitas');
  }
};

// Los formularios publicados son inmutables (trigger en DB): un ARCHIVED no
// puede volver a ACTIVE en la misma fila. "Activar" un archivado republica
// su mismo contenido como una versión nueva, reutilizando el flujo normal
// de publicación (que ya archiva el activo actual y garantiza <=1 activo).
const buildRepublishPayload = (detail) => {
  const tiposById = new Map(detail.tipos.map((tipo) => [tipo.id, tipo.nombre]));
  const toNames = (ids) => (ids || []).map((id) => tiposById.get(id)).filter(Boolean);
  return {
    title: detail.titulo,
    showDateTime: detail.mostrar_fecha_hora,
    tiposVisita: detail.tipos.map((tipo) => ({
      nombre: tipo.nombre,
      requiere_salida: tipo.requiere_salida,
    })),
    fields: detail.fields.map((field) => ({
      field_key: field.field_key,
      label: field.label,
      type: field.type,
      required: field.required,
      aplica_a: field.aplica_a === 'TODOS' ? 'TODOS' : toNames(field.tipos),
      options: field.options || [],
    })),
    groups: detail.groups.map((group) => ({
      group_key: group.group_key,
      label: group.label,
      min_count: group.min_count,
      aplica_a: group.aplica_a === 'TODOS' ? 'TODOS' : toNames(group.tipos),
      fields: group.fields.map((field) => ({
        field_key: field.field_key,
        label: field.label,
        type: field.type,
        required: field.required,
      })),
    })),
  };
};

const reactivateVisitForm = async (req, res) => {
  try {
    const formId = parsePositiveInteger(req.params.formId, 'El formulario es inválido');
    const reactivated = await db.transaction(async (client) => {
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
      if (form.estado !== 'ARCHIVED') {
        throw domainError(
          409,
          'VISIT_FORM_NOT_ARCHIVED',
          'Solo se puede activar un formulario archivado'
        );
      }
      const detail = await findVisitFormVersionDetail({ formId, executor: client });
      const payload = buildRepublishPayload(detail);
      const published = await publishVisitFormForLocation({
        client,
        locationId: form.ubicacion_id,
        title: payload.title,
        showDateTime: payload.showDateTime,
        tiposVisita: payload.tiposVisita,
        fields: payload.fields,
        groups: payload.groups,
        userId: actor.id,
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_visit_form_versions',
        operacion: 'INSERT',
        registro_id: published.id,
        datos_nuevos: published,
        ...auditFromReq(req),
      });
      return published;
    });
    return res.status(201).json({
      success: true,
      message: 'Formulario activado como nueva versión',
      data: reactivated,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error al activar formulario de visitas');
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
      if (form.mostrar_casa === true && (!req.body.manzana || !req.body.villa)) {
        const error = domainError(400, 'VISIT_HOUSE_REQUIRED', 'Manzana y Villa son requeridas');
        error.details = {
          ...(!req.body.manzana ? { manzana: ['Manzana es requerida'] } : {}),
          ...(!req.body.villa ? { villa: ['Villa es requerida'] } : {}),
        };
        throw error;
      }
      const responses = validateVisitResponses(
        form.fields,
        req.body.respuestas || {},
        req.body.tipo_visita_id
      );
      const groupResponses = validateVisitGroupResponses(
        form.groups || [],
        req.body.grupos || {},
        req.body.tipo_visita_id
      );
      const house =
        form.mostrar_casa !== false && req.body.manzana && req.body.villa
          ? `${req.body.manzana} - ${req.body.villa}`
          : null;
      const autorizada = req.body.autorizada !== false;
      const detail = visitDetail({
        action: autorizada ? 'Ingreso' : 'No autorizada',
        visitorName: req.body.visitante_nombre,
        tipoVisitaNombre: tipoVisita.nombre,
        plate: req.body.placa,
        house,
      });
      const registro = await insertBitacoraRegistro({
        client,
        locationId: location.id,
        blockId: null,
        villaId: null,
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        occurredAt: new Date(),
        detail,
      });
      const visita = await createVisit({
        client,
        locationId: location.id,
        blockId: null,
        villaId: null,
        blockText: form.mostrar_casa === false ? null : req.body.manzana,
        villaText: form.mostrar_casa === false ? null : req.body.villa,
        principalResidentId: null,
        formVersionId: form.id,
        visitor: {
          nombre: req.body.visitante_nombre || null,
          documento: req.body.visitante_documento || null,
          telefono: req.body.visitante_telefono || null,
          tipoVisitaId: req.body.tipo_visita_id,
          placa: req.body.placa || null,
        },
        actorUserId: actor.id,
        actorCollaboratorId: actor.colaborador_id,
        entryLogId: registro.id,
        estado: autorizada ? 'ABIERTA' : 'NO_AUTORIZADA',
        motivoNoAutorizacion: autorizada ? null : req.body.motivo_no_autorizacion,
      });
      await insertVisitResponses({ client, visitId: visita.id, fields: form.fields, responses });
      await insertVisitGroupResponses({
        client,
        visitId: visita.id,
        formVersionId: form.id,
        groups: form.groups || [],
        entries: groupResponses,
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_visitas',
        operacion: 'INSERT',
        registro_id: visita.id,
        datos_nuevos: { ...visita, respuestas: responses, grupos: groupResponses },
        ...auditFromReq(req),
      });
      await logAuditStrict(client, {
        tabla: 'bitacora_registros',
        operacion: 'INSERT',
        registro_id: registro.id,
        datos_nuevos: registro,
        ...auditFromReq(req),
      });

      let finalVisita = visita;
      if (autorizada && !tipoVisita.requiere_salida) {
        const exitDetail = visitDetail({
          action: 'Salida',
          visitorName: req.body.visitante_nombre,
          tipoVisitaNombre: tipoVisita.nombre,
          plate: req.body.placa,
          house,
        });
        const exitRegistro = await insertBitacoraRegistro({
          client,
          locationId: location.id,
          blockId: null,
          villaId: null,
          actorUserId: actor.id,
          actorCollaboratorId: actor.colaborador_id,
          occurredAt: new Date(),
          detail: exitDetail,
        });
        const closedVisita = await closeVisit({
          client,
          visitId: visita.id,
          actorUserId: actor.id,
          actorCollaboratorId: actor.colaborador_id,
          exitLogId: exitRegistro.id,
        });
        await logAuditStrict(client, {
          tabla: 'bitacora_visitas',
          operacion: 'UPDATE',
          registro_id: closedVisita.id,
          datos_anteriores: visita,
          datos_nuevos: closedVisita,
          ...auditFromReq(req),
        });
        await logAuditStrict(client, {
          tabla: 'bitacora_registros',
          operacion: 'INSERT',
          registro_id: exitRegistro.id,
          datos_nuevos: exitRegistro,
          ...auditFromReq(req),
        });
        finalVisita = closedVisita;
      }

      return { ...finalVisita, respuestas: responses, grupos: groupResponses };
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
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'entrada_at',
      allowedSorts: VISIT_SORTS,
    });
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
      if (!visita.requiere_salida) {
        throw domainError(
          409,
          'VISIT_EXIT_NOT_REQUIRED',
          'Este tipo de visita no requiere registrar salida'
        );
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
  deleteArchivedVisitForm,
  exportRegistros,
  exportVisitas,
  exportVisitForms,
  getActiveVisitForm,
  getVisitFormDetail,
  getResumen,
  getVisitForms,
  getRegistros,
  getVisitas,
  getUbicacionesVisibles,
  normalizeHistoryFilters,
  normalizeVisitFilters,
  getCurrentUserScope,
  publishVisitForm,
  archiveVisitForm,
  reactivateVisitForm,
};
