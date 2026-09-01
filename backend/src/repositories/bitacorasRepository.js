const db = require('../config/database');

const VISIT_FORM_PUBLISH_LOCK_CLASS_ID = 29004;

const acquireVisitFormPublishLock = async ({ client, locationId }) => {
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [
    VISIT_FORM_PUBLISH_LOCK_CLASS_ID,
    locationId,
  ]);
};

const findLockedUserLocationAssignment = async ({ client, userId, locationId }) => {
  const result = await client.query(
    `SELECT usuario_id, ubicacion_id
     FROM usuario_ubicaciones
     WHERE usuario_id = $1 AND ubicacion_id = $2
     FOR KEY SHARE`,
    [userId, locationId]
  );
  return result.rows[0] || null;
};

const findLockedBlock = async ({ client, blockId }) => {
  const result = await client.query(
    `SELECT id, ubicacion_id, nombre, estado
     FROM manzanas
     WHERE id = $1
     FOR SHARE`,
    [blockId]
  );
  return result.rows[0] || null;
};

const findVisibleBlock = async ({ blockId, hasGlobalScope, userId, executor = db }) => {
  const params = [blockId];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'm.ubicacion_id',
  });
  const result = await executor.query(
    `SELECT m.id, m.ubicacion_id, m.nombre, m.estado
     FROM manzanas m
     WHERE m.id = $1${scopeCondition ? ` AND ${scopeCondition}` : ''}`,
    params
  );
  return result.rows[0] || null;
};

const findVisibleLocation = async ({ locationId, hasGlobalScope, userId, executor = db }) => {
  const params = [locationId];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'u.id',
  });
  const result = await executor.query(
    `SELECT u.id, u.nombre, u.cliente_id, u.tipo_punto
     FROM ubicaciones u
     WHERE u.id = $1${scopeCondition ? ` AND ${scopeCondition}` : ''}`,
    params
  );
  return result.rows[0] || null;
};

const findLockedVilla = async ({ client, villaId }) => {
  const result = await client.query(
    `SELECT id, manzana_id, identificador, estado
     FROM villas
     WHERE id = $1
     FOR SHARE`,
    [villaId]
  );
  return result.rows[0] || null;
};

const findActivePrincipalResidentForVilla = async ({ client, villaId }) => {
  const result = await client.query(
    `SELECT id, villa_id, nombre, contacto
     FROM residentes
     WHERE villa_id = $1 AND es_principal = TRUE AND activo = TRUE
     ORDER BY created_at DESC, id DESC
     LIMIT 1
     FOR SHARE`,
    [villaId]
  );
  return result.rows[0] || null;
};

const buildScopeCondition = ({
  hasGlobalScope,
  userId,
  params,
  locationExpression = 'br.ubicacion_id',
}) => {
  if (hasGlobalScope) {
    return undefined;
  }

  params.push(userId);
  return `EXISTS (
    SELECT 1
    FROM usuario_ubicaciones uu
    WHERE uu.usuario_id = $${params.length}
      AND uu.ubicacion_id = ${locationExpression}
  )`;
};

const buildHistoryFilters = ({ filters, hasGlobalScope, userId }) => {
  const params = [];
  const conditions = [];
  const scopeCondition = buildScopeCondition({ hasGlobalScope, userId, params });

  if (scopeCondition) {
    conditions.push(scopeCondition);
  }
  if (filters.ubicacionId) {
    params.push(filters.ubicacionId);
    conditions.push(`br.ubicacion_id = $${params.length}`);
  }
  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    conditions.push(`br.ocurrido_at >= $${params.length}::date`);
  }
  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    conditions.push(`br.ocurrido_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.estado) {
    params.push(filters.estado);
    conditions.push(`br.estado = $${params.length}`);
  }
  if (filters.autor) {
    params.push(`%${filters.autor}%`);
    conditions.push(`(
      EXISTS (
        SELECT 1
        FROM colaboradores autor_c
        WHERE autor_c.id = br.autor_colaborador_id
          AND autor_c.nombres_completos ILIKE $${params.length}
      )
      OR EXISTS (
        SELECT 1
        FROM usuarios autor_u
        WHERE autor_u.id = br.autor_usuario_id
          AND autor_u.usuario ILIKE $${params.length}
      )
    )`);
  }

  return {
    params,
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
  };
};

const findHistory = async ({ filters, hasGlobalScope, userId, pagination, executor = db }) => {
  const { params, where } = buildHistoryFilters({ filters, hasGlobalScope, userId });
  const countResult = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM bitacora_registros br
     ${where}`,
    params
  );
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;
  const dataResult = await executor.query(
    `SELECT
       br.id,
       br.ubicacion_id,
       u.nombre AS ubicacion_nombre,
       u.tipo_punto,
       br.manzana_id,
       m.nombre AS manzana_nombre,
       br.villa_id,
       v.identificador AS villa_identificador,
       br.autor_usuario_id,
       au.usuario AS autor_usuario,
       br.autor_colaborador_id,
       c.nombres_completos AS autor_colaborador_nombre,
       br.ocurrido_at,
       br.detalle,
       br.estado,
       br.created_at,
       br.anulado_at,
       br.anulado_por_usuario_id,
       br.motivo_anulacion
     FROM bitacora_registros br
     INNER JOIN ubicaciones u ON u.id = br.ubicacion_id
     INNER JOIN usuarios au ON au.id = br.autor_usuario_id
     INNER JOIN colaboradores c ON c.id = br.autor_colaborador_id
     LEFT JOIN manzanas m ON m.id = br.manzana_id
     LEFT JOIN villas v ON v.id = br.villa_id
     ${where}
     ORDER BY br.ocurrido_at DESC, br.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );

  return { items: dataResult.rows, total: countResult.rows[0]?.total || 0 };
};

const findActiveBlocksForLocation = async ({ locationId, executor = db }) => {
  const result = await executor.query(
    `SELECT id, ubicacion_id, nombre
     FROM manzanas
     WHERE ubicacion_id = $1 AND estado = 'activo'
     ORDER BY nombre ASC, id ASC`,
    [locationId]
  );
  return result.rows;
};

const findActiveVillasForBlock = async ({ blockId, executor = db }) => {
  const result = await executor.query(
    `SELECT
       v.id,
       v.manzana_id,
       v.identificador,
       r.id AS residente_principal_id,
       r.nombre AS residente_principal_nombre,
       r.contacto AS residente_principal_contacto
     FROM villas v
     INNER JOIN residentes r
       ON r.villa_id = v.id
      AND r.es_principal = TRUE
      AND r.activo = TRUE
     WHERE v.manzana_id = $1 AND v.estado = 'activo'
     ORDER BY v.identificador ASC, v.id ASC`,
    [blockId]
  );
  return result.rows;
};

const findVisitFormTipos = async ({ formVersionId, executor = db }) => {
  const result = await executor.query(
    `SELECT id, form_version_id, nombre, sort_order
     FROM bitacora_visit_form_tipos
     WHERE form_version_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [formVersionId]
  );
  return result.rows;
};

const attachFieldTipos = async ({ formVersionId, fields, executor = db }) => {
  if (fields.length === 0) {
    return fields;
  }
  const tiposResult = await executor.query(
    `SELECT form_field_id, tipo_id
     FROM bitacora_visit_form_field_tipos
     WHERE form_version_id = $1`,
    [formVersionId]
  );
  const tiposByField = new Map();
  tiposResult.rows.forEach((row) => {
    const list = tiposByField.get(row.form_field_id) || [];
    list.push(row.tipo_id);
    tiposByField.set(row.form_field_id, list);
  });
  return fields.map((field) => ({
    ...field,
    tipos: tiposByField.get(field.id) || [],
  }));
};

const findActiveVisitFormForLocation = async ({ locationId, executor = db }) => {
  const versionResult = await executor.query(
    `SELECT id, ubicacion_id, version, titulo, mostrar_fecha_hora, estado, created_by, published_by, created_at, published_at
     FROM bitacora_visit_form_versions
     WHERE ubicacion_id = $1 AND estado = 'ACTIVE' AND published_at IS NOT NULL
     ORDER BY version DESC
     LIMIT 1`,
    [locationId]
  );
  const version = versionResult.rows[0] || null;
  if (!version) {
    return null;
  }

  const [fieldsResult, tipos] = await Promise.all([
    executor.query(
      `SELECT id, form_version_id, field_key, label, type, required, aplica_a, options, sort_order
       FROM bitacora_visit_form_fields
       WHERE form_version_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [version.id]
    ),
    findVisitFormTipos({ formVersionId: version.id, executor }),
  ]);
  const fields = await attachFieldTipos({
    formVersionId: version.id,
    fields: fieldsResult.rows,
    executor,
  });
  return { ...version, tipos, fields };
};

const findVisitForms = async ({ hasGlobalScope, userId, filters, pagination, executor = db }) => {
  const params = [];
  const conditions = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bfv.ubicacion_id',
  });
  if (scopeCondition) {
    conditions.push(scopeCondition);
  }
  if (filters.nombre) {
    params.push(`%${filters.nombre}%`);
    conditions.push(`bfv.titulo ILIKE $${params.length}`);
  }
  if (filters.locationId) {
    params.push(filters.locationId);
    conditions.push(`bfv.ubicacion_id = $${params.length}`);
  }
  if (filters.creator) {
    params.push(`%${filters.creator}%`);
    conditions.push(`creator.usuario ILIKE $${params.length}`);
  }
  if (filters.estado) {
    params.push(filters.estado);
    conditions.push(`bfv.estado = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM bitacora_visit_form_versions bfv
     LEFT JOIN usuarios creator ON creator.id = bfv.created_by
     ${where}`,
    params
  );
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const result = await executor.query(
    `SELECT bfv.id, bfv.ubicacion_id, u.nombre AS ubicacion_nombre,
       bfv.version, bfv.titulo, bfv.mostrar_fecha_hora, bfv.estado,
       bfv.created_by, creator.usuario AS creador,
       bfv.published_at
     FROM bitacora_visit_form_versions bfv
     INNER JOIN ubicaciones u ON u.id = bfv.ubicacion_id
     LEFT JOIN usuarios creator ON creator.id = bfv.created_by
     ${where}
     ORDER BY bfv.published_at DESC NULLS LAST, bfv.id DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );
  return { items: result.rows, total: countResult.rows[0]?.total || 0 };
};

const findVisitFormCreators = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bfv.ubicacion_id',
  });
  const result = await executor.query(
    `SELECT DISTINCT creator.id, creator.usuario
     FROM bitacora_visit_form_versions bfv
     INNER JOIN usuarios creator ON creator.id = bfv.created_by
     ${scopeCondition ? `WHERE ${scopeCondition}` : ''}
     ORDER BY creator.usuario ASC, creator.id ASC`,
    params
  );
  return result.rows;
};

const publishVisitFormForLocation = async ({
  client,
  locationId,
  title,
  showDateTime,
  tiposVisita,
  fields,
  userId,
}) => {
  await acquireVisitFormPublishLock({ client, locationId });
  await client.query(
    `SELECT id
     FROM bitacora_visit_form_versions
     WHERE ubicacion_id = $1
     FOR UPDATE`,
    [locationId]
  );
  const nextVersionResult = await client.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM bitacora_visit_form_versions
     WHERE ubicacion_id = $1`,
    [locationId]
  );
  const nextVersion = nextVersionResult.rows[0]?.next_version || 1;
  await client.query(
    `UPDATE bitacora_visit_form_versions
     SET estado = 'ARCHIVED'
     WHERE ubicacion_id = $1 AND estado = 'ACTIVE'`,
    [locationId]
  );
  const versionResult = await client.query(
    `INSERT INTO bitacora_visit_form_versions
       (ubicacion_id, version, titulo, mostrar_fecha_hora, estado, created_by, published_by)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)
     RETURNING id, ubicacion_id, version, titulo, mostrar_fecha_hora, estado, created_by, published_by, created_at, published_at`,
    [locationId, nextVersion, title || 'Formulario de visitas', showDateTime, userId]
  );
  const version = versionResult.rows[0];

  const tipoIdByName = new Map();
  for (const [index, nombre] of tiposVisita.entries()) {
    const tipoResult = await client.query(
      `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [version.id, nombre, index + 1]
    );
    tipoIdByName.set(nombre, tipoResult.rows[0].id);
  }

  for (const [index, field] of fields.entries()) {
    const aplicaA = field.aplica_a === 'TODOS' ? 'TODOS' : 'SELECCIONADOS';
    const fieldResult = await client.query(
      `INSERT INTO bitacora_visit_form_fields
        (form_version_id, field_key, label, type, required, aplica_a, options, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      [
        version.id,
        field.field_key,
        field.label,
        field.type,
        Boolean(field.required),
        aplicaA,
        JSON.stringify(field.options || []),
        index + 1,
      ]
    );
    if (aplicaA === 'SELECCIONADOS') {
      for (const tipoNombre of field.aplica_a) {
        await client.query(
          `INSERT INTO bitacora_visit_form_field_tipos (form_field_id, form_version_id, tipo_id)
           VALUES ($1, $2, $3)`,
          [fieldResult.rows[0].id, version.id, tipoIdByName.get(tipoNombre)]
        );
      }
    }
  }
  await client.query(
    `UPDATE bitacora_visit_form_versions
     SET published_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [version.id]
  );
  return findActiveVisitFormForLocation({ locationId, executor: client });
};

const findLockedVisitFormVersion = async ({ client, formId }) => {
  const result = await client.query(
    `SELECT id, ubicacion_id, version, titulo, mostrar_fecha_hora, estado,
       created_by, published_by, created_at, published_at
     FROM bitacora_visit_form_versions
     WHERE id = $1
     FOR UPDATE`,
    [formId]
  );
  return result.rows[0] || null;
};

const archiveVisitFormVersion = async ({ client, formId }) => {
  const result = await client.query(
    `UPDATE bitacora_visit_form_versions
     SET estado = 'ARCHIVED'
     WHERE id = $1 AND estado = 'ACTIVE'
     RETURNING id, ubicacion_id, version, titulo, mostrar_fecha_hora, estado,
       created_by, published_by, created_at, published_at`,
    [formId]
  );
  return result.rows[0] || null;
};

const insertBitacoraRegistro = async ({
  client,
  locationId,
  blockId,
  villaId,
  actorUserId,
  actorCollaboratorId,
  occurredAt,
  detail,
}) => {
  const result = await client.query(
    `INSERT INTO bitacora_registros
      (ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
       ocurrido_at, detalle)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
               ocurrido_at, detalle, estado, created_at`,
    [
      locationId,
      blockId ?? null,
      villaId ?? null,
      actorUserId,
      actorCollaboratorId,
      occurredAt,
      detail,
    ]
  );
  return result.rows[0];
};

const createVisit = async ({
  client,
  locationId,
  blockId,
  villaId,
  principalResidentId,
  formVersionId,
  visitor,
  actorUserId,
  actorCollaboratorId,
  entryLogId,
}) => {
  const result = await client.query(
    `INSERT INTO bitacora_visitas
      (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
       visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
       registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
       visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa, estado, entrada_at,
       salida_at, registrado_por_usuario_id, registrado_por_colaborador_id,
       cerrado_por_usuario_id, cerrado_por_colaborador_id, entrada_bitacora_registro_id,
       salida_bitacora_registro_id, created_at, updated_at`,
    [
      locationId,
      blockId,
      villaId,
      principalResidentId,
      formVersionId,
      visitor.nombre,
      visitor.documento,
      visitor.telefono,
      visitor.tipoVisitaId,
      visitor.placa,
      actorUserId,
      actorCollaboratorId,
      entryLogId,
    ]
  );
  return result.rows[0];
};

const insertVisitResponses = async ({ client, visitId, fields, responses }) => {
  for (const field of fields) {
    const rawValue = responses[field.field_key];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }
    await client.query(
      `INSERT INTO bitacora_visita_respuestas
        (visita_id, form_field_id, field_key_snapshot, label_snapshot, type_snapshot, value_text, value_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        visitId,
        field.id,
        field.field_key,
        field.label,
        field.type,
        typeof rawValue === 'boolean' ? String(rawValue) : String(rawValue),
        JSON.stringify(rawValue),
      ]
    );
  }
};

const buildVisitFilters = ({ filters, hasGlobalScope, userId }) => {
  const params = [];
  const conditions = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bv.ubicacion_id',
  });
  if (scopeCondition) {
    conditions.push(scopeCondition);
  }
  if (filters.estado) {
    params.push(filters.estado);
    conditions.push(`bv.estado = $${params.length}`);
  }
  if (filters.creator) {
    params.push(`%${filters.creator}%`);
    conditions.push(
      `(c.nombres_completos ILIKE $${params.length} OR u.usuario ILIKE $${params.length})`
    );
  }
  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    conditions.push(`bv.entrada_at >= $${params.length}::date`);
  }
  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    conditions.push(`bv.entrada_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const searchIndex = params.length;
    conditions.push(
      `(bv.visitante_nombre ILIKE $${searchIndex} OR bv.placa ILIKE $${searchIndex}
        OR m.nombre ILIKE $${searchIndex} OR v.identificador ILIKE $${searchIndex}
        OR r.nombre ILIKE $${searchIndex})`
    );
  }
  return {
    params,
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
  };
};

const findVisits = async ({ filters, hasGlobalScope, userId, pagination, executor = db }) => {
  const { params, where } = buildVisitFilters({ filters, hasGlobalScope, userId });
  const countResult = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM bitacora_visitas bv
     INNER JOIN usuarios u ON u.id = bv.registrado_por_usuario_id
     INNER JOIN colaboradores c ON c.id = bv.registrado_por_colaborador_id
     INNER JOIN manzanas m ON m.id = bv.manzana_id
     INNER JOIN villas v ON v.id = bv.villa_id
     INNER JOIN residentes r ON r.id = bv.residente_principal_id
     ${where}`,
    params
  );
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;
  const dataResult = await executor.query(
    `SELECT
       bv.id, bv.ubicacion_id, ub.nombre AS ubicacion_nombre,
       bv.manzana_id, m.nombre AS manzana_nombre,
       bv.villa_id, v.identificador AS villa_identificador,
       bv.residente_principal_id, r.nombre AS residente_principal_nombre,
       r.contacto AS residente_principal_contacto,
       bv.form_version_id, bfv.version AS form_version,
       bv.visitante_nombre, bv.visitante_documento, bv.visitante_telefono,
       bv.tipo_visita_id, tv.nombre AS tipo_visita_nombre, bv.placa,
       bv.estado, bv.entrada_at, bv.salida_at,
       bv.registrado_por_usuario_id, u.usuario AS registrado_por_usuario,
       bv.registrado_por_colaborador_id, c.nombres_completos AS registrado_por_colaborador_nombre,
       bv.cerrado_por_usuario_id, cu.usuario AS cerrado_por_usuario,
       bv.cerrado_por_colaborador_id, cc.nombres_completos AS cerrado_por_colaborador_nombre,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'field_key', bvr.field_key_snapshot,
             'label', bvr.label_snapshot,
             'type', bvr.type_snapshot,
             'value', bvr.value_json
           )
           ORDER BY bff.sort_order, bvr.id
         ) FILTER (WHERE bvr.id IS NOT NULL),
         '[]'::jsonb
       ) AS respuestas
     FROM bitacora_visitas bv
     INNER JOIN ubicaciones ub ON ub.id = bv.ubicacion_id
     INNER JOIN manzanas m ON m.id = bv.manzana_id
     INNER JOIN villas v ON v.id = bv.villa_id
     INNER JOIN residentes r ON r.id = bv.residente_principal_id
     INNER JOIN bitacora_visit_form_versions bfv ON bfv.id = bv.form_version_id
     INNER JOIN bitacora_visit_form_tipos tv ON tv.id = bv.tipo_visita_id
     INNER JOIN usuarios u ON u.id = bv.registrado_por_usuario_id
     INNER JOIN colaboradores c ON c.id = bv.registrado_por_colaborador_id
     LEFT JOIN usuarios cu ON cu.id = bv.cerrado_por_usuario_id
     LEFT JOIN colaboradores cc ON cc.id = bv.cerrado_por_colaborador_id
     LEFT JOIN bitacora_visita_respuestas bvr ON bvr.visita_id = bv.id
     LEFT JOIN bitacora_visit_form_fields bff ON bff.id = bvr.form_field_id
     ${where}
     GROUP BY bv.id, ub.nombre, m.nombre, v.identificador, r.nombre, r.contacto, bfv.version,
       tv.nombre, u.usuario, c.nombres_completos, cu.usuario, cc.nombres_completos
     ORDER BY bv.entrada_at DESC, bv.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );
  return { items: dataResult.rows, total: countResult.rows[0]?.total || 0 };
};

const findVisitCreators = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bv.ubicacion_id',
  });
  const result = await executor.query(
    `SELECT DISTINCT c.id, c.nombres_completos AS nombre
     FROM bitacora_visitas bv
     INNER JOIN colaboradores c ON c.id = bv.registrado_por_colaborador_id
     ${scopeCondition ? `WHERE ${scopeCondition}` : ''}
     ORDER BY c.nombres_completos ASC, c.id ASC`,
    params
  );
  return result.rows;
};

const findLockedVisit = async ({ client, visitId }) => {
  const result = await client.query(
    `SELECT bv.id, bv.ubicacion_id, bv.manzana_id, m.nombre AS manzana_nombre,
       bv.villa_id, v.identificador AS villa_identificador, bv.estado,
       bv.visitante_nombre, bv.tipo_visita_id, tv.nombre AS tipo_visita_nombre, bv.placa,
       bv.registrado_por_usuario_id,
       bv.registrado_por_colaborador_id, bv.entrada_at
     FROM bitacora_visitas bv
     INNER JOIN manzanas m ON m.id = bv.manzana_id
     INNER JOIN villas v ON v.id = bv.villa_id
     INNER JOIN bitacora_visit_form_tipos tv ON tv.id = bv.tipo_visita_id
     WHERE bv.id = $1
     FOR UPDATE OF bv`,
    [visitId]
  );
  return result.rows[0] || null;
};

const closeVisit = async ({ client, visitId, actorUserId, actorCollaboratorId, exitLogId }) => {
  const result = await client.query(
    `UPDATE bitacora_visitas
     SET estado = 'CERRADA',
         salida_at = CURRENT_TIMESTAMP,
         cerrado_por_usuario_id = $2,
         cerrado_por_colaborador_id = $3,
         salida_bitacora_registro_id = $4
     WHERE id = $1
     RETURNING id, ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
       visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa, estado, entrada_at,
       salida_at, registrado_por_usuario_id, registrado_por_colaborador_id,
       cerrado_por_usuario_id, cerrado_por_colaborador_id, entrada_bitacora_registro_id,
       salida_bitacora_registro_id, created_at, updated_at`,
    [visitId, actorUserId, actorCollaboratorId, exitLogId]
  );
  return result.rows[0];
};

const cancelVisit = async ({
  client,
  visitId,
  actorUserId,
  actorCollaboratorId,
  exitLogId,
  motivo,
}) => {
  const result = await client.query(
    `UPDATE bitacora_visitas
     SET estado = 'ANULADA',
         salida_at = CURRENT_TIMESTAMP,
         cerrado_por_usuario_id = $2,
         cerrado_por_colaborador_id = $3,
         salida_bitacora_registro_id = $4,
         motivo_anulacion = $5
     WHERE id = $1
     RETURNING id, ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
       visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa, estado, entrada_at,
       salida_at, registrado_por_usuario_id, registrado_por_colaborador_id,
       cerrado_por_usuario_id, cerrado_por_colaborador_id, entrada_bitacora_registro_id,
       salida_bitacora_registro_id, motivo_anulacion, created_at, updated_at`,
    [visitId, actorUserId, actorCollaboratorId, exitLogId, motivo]
  );
  return result.rows[0];
};

const findVisibleLocations = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const conditions = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'u.id',
  });
  if (scopeCondition) {
    conditions.push(scopeCondition);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await executor.query(
    `SELECT u.id, u.nombre, u.cliente_id, c.nombre AS cliente_nombre, u.tipo_punto
     FROM ubicaciones u
     LEFT JOIN clientes c ON c.id = u.cliente_id
     ${where}
     ORDER BY c.nombre ASC NULLS LAST, u.nombre ASC, u.id ASC`,
    params
  );
  return result.rows;
};

module.exports = {
  buildHistoryFilters,
  findActiveBlocksForLocation,
  findActiveVillasForBlock,
  findActivePrincipalResidentForVilla,
  findActiveVisitFormForLocation,
  findVisitForms,
  findVisitFormCreators,
  findVisibleBlock,
  findVisibleLocation,
  findLockedBlock,
  findLockedVilla,
  findLockedUserLocationAssignment,
  findHistory,
  findLockedVisit,
  findVisits,
  findVisitCreators,
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
};
