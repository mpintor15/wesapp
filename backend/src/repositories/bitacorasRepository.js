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

  // Registro solo muestra lo creado manualmente vía "Registrar Bitácora";
  // las entradas de auditoría que generan las Visitas (ingreso/salida/
  // anulación) quedan fuera, aunque siguen existiendo en la tabla.
  // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
  conditions.push("br.origen = 'MANUAL'");

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
       br.motivo_anulacion,
       COUNT(*) OVER()::int AS total_count
     FROM bitacora_registros br
     INNER JOIN ubicaciones u ON u.id = br.ubicacion_id
     INNER JOIN usuarios au ON au.id = br.autor_usuario_id
     INNER JOIN colaboradores c ON c.id = br.autor_colaborador_id
     LEFT JOIN manzanas m ON m.id = br.manzana_id
     LEFT JOIN villas v ON v.id = br.villa_id
     ${where}
     ORDER BY ${pagination.sortExpression || 'br.ocurrido_at'} ${(pagination.sortOrder || 'desc').toUpperCase()} NULLS LAST,
       br.id ${(pagination.sortOrder || 'desc').toUpperCase()}
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );

  const total = dataResult.rows[0]?.total_count || 0;
  const items = dataResult.rows.map(({ total_count: _totalCount, ...row }) => row);
  return { items, total };
};

const countHistoryScoped = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const scopeCondition = buildScopeCondition({ hasGlobalScope, userId, params });
  // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
  const conditions = ["br.origen = 'MANUAL'", ...(scopeCondition ? [scopeCondition] : [])];
  const result = await executor.query(
    `SELECT COUNT(*)::int AS total FROM bitacora_registros br WHERE ${conditions.join(' AND ')}`,
    params
  );
  return result.rows[0]?.total || 0;
};

const countVisitasAbiertasScoped = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bv.ubicacion_id',
  });
  const conditions = scopeCondition ? [scopeCondition] : [];
  params.push('ABIERTA');
  conditions.push(`bv.estado = $${params.length}`);
  const result = await executor.query(
    `SELECT COUNT(*)::int AS total FROM bitacora_visitas bv WHERE ${conditions.join(' AND ')}`,
    params
  );
  return result.rows[0]?.total || 0;
};

const countVisitFormsScoped = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bfv.ubicacion_id',
  });
  const conditions = ['bfv.deleted_at IS NULL', ...(scopeCondition ? [scopeCondition] : [])];
  const result = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM bitacora_visit_form_versions bfv
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  return result.rows[0]?.total || 0;
};

const getBitacorasResumen = async ({
  hasGlobalScope,
  userId,
  includeHistorial,
  includeFormularios,
  executor = db,
}) => {
  const [registros, visitas, formularios] = await Promise.all([
    includeHistorial ? countHistoryScoped({ hasGlobalScope, userId, executor }) : null,
    includeHistorial ? countVisitasAbiertasScoped({ hasGlobalScope, userId, executor }) : null,
    includeFormularios ? countVisitFormsScoped({ hasGlobalScope, userId, executor }) : null,
  ]);
  return { registros, visitas, formularios };
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
    `SELECT id, form_version_id, nombre, requiere_salida, sort_order
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

const attachGroupTipos = async ({ formVersionId, groups, executor = db }) => {
  if (groups.length === 0) {
    return groups;
  }
  const tiposResult = await executor.query(
    `SELECT group_id, tipo_id
     FROM bitacora_visit_form_group_tipos
     WHERE form_version_id = $1`,
    [formVersionId]
  );
  const tiposByGroup = new Map();
  tiposResult.rows.forEach((row) => {
    const list = tiposByGroup.get(row.group_id) || [];
    list.push(row.tipo_id);
    tiposByGroup.set(row.group_id, list);
  });
  return groups.map((group) => ({
    ...group,
    tipos: tiposByGroup.get(group.id) || [],
  }));
};

const findVisitFormGroups = async ({ formVersionId, executor = db }) => {
  const [groupsResult, fieldsResult] = await Promise.all([
    executor.query(
      `SELECT id, form_version_id, group_key, label, min_count, aplica_a, sort_order
       FROM bitacora_visit_form_groups
       WHERE form_version_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [formVersionId]
    ),
    executor.query(
      `SELECT id, group_id, form_version_id, field_key, label, type, required, options, sort_order
       FROM bitacora_visit_form_group_fields
       WHERE form_version_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [formVersionId]
    ),
  ]);
  const fieldsByGroup = new Map();
  fieldsResult.rows.forEach((field) => {
    const list = fieldsByGroup.get(field.group_id) || [];
    list.push(field);
    fieldsByGroup.set(field.group_id, list);
  });
  const groups = groupsResult.rows.map((group) => ({
    ...group,
    fields: fieldsByGroup.get(group.id) || [],
  }));
  return attachGroupTipos({ formVersionId, groups, executor });
};

const attachVersionDetails = async (version, executor) => {
  if (!version) {
    return null;
  }
  const [fieldsResult, tipos, groups] = await Promise.all([
    executor.query(
      `SELECT id, form_version_id, field_key, label, type, required, aplica_a, options, sort_order
       FROM bitacora_visit_form_fields
       WHERE form_version_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [version.id]
    ),
    findVisitFormTipos({ formVersionId: version.id, executor }),
    findVisitFormGroups({ formVersionId: version.id, executor }),
  ]);
  const fields = await attachFieldTipos({
    formVersionId: version.id,
    fields: fieldsResult.rows,
    executor,
  });
  return { ...version, tipos, fields, groups };
};

const findActiveVisitFormForLocation = async ({ locationId, executor = db }) => {
  const versionResult = await executor.query(
    `SELECT id, ubicacion_id, version, titulo, mostrar_fecha_hora, estado, created_by, published_by, created_at, published_at
     FROM bitacora_visit_form_versions
     WHERE ubicacion_id = $1 AND estado = 'ACTIVE' AND published_at IS NOT NULL
       AND deleted_at IS NULL
     ORDER BY version DESC
     LIMIT 1`,
    [locationId]
  );
  return attachVersionDetails(versionResult.rows[0] || null, executor);
};

const findVisitFormVersionDetail = async ({ formId, executor = db }) => {
  const versionResult = await executor.query(
    `SELECT id, ubicacion_id, version, titulo, mostrar_fecha_hora, estado, created_by, published_by, created_at, published_at
     FROM bitacora_visit_form_versions
     WHERE id = $1 AND deleted_at IS NULL`,
    [formId]
  );
  return attachVersionDetails(versionResult.rows[0] || null, executor);
};

const findVisitForms = async ({ hasGlobalScope, userId, filters, pagination, executor = db }) => {
  const params = [];
  const conditions = ['bfv.deleted_at IS NULL'];
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
  const dataParams = [...params, pagination.pageSize, pagination.offset];
  const result = await executor.query(
    `SELECT bfv.id, bfv.ubicacion_id, u.nombre AS ubicacion_nombre,
       bfv.version, bfv.titulo, bfv.mostrar_fecha_hora, bfv.estado,
       bfv.created_by, creator.usuario AS creador,
       bfv.published_at,
       COUNT(*) OVER()::int AS total_count
     FROM bitacora_visit_form_versions bfv
     INNER JOIN ubicaciones u ON u.id = bfv.ubicacion_id
     LEFT JOIN usuarios creator ON creator.id = bfv.created_by
     ${where}
     ORDER BY ${pagination.sortExpression || 'bfv.published_at'} ${(pagination.sortOrder || 'desc').toUpperCase()} NULLS LAST,
       bfv.id ${(pagination.sortOrder || 'desc').toUpperCase()}
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );
  const total = result.rows[0]?.total_count || 0;
  const items = result.rows.map(({ total_count: _totalCount, ...row }) => row);
  return { items, total };
};

const findVisitFormCreators = async ({ hasGlobalScope, userId, executor = db }) => {
  const params = [];
  const scopeCondition = buildScopeCondition({
    hasGlobalScope,
    userId,
    params,
    locationExpression: 'bfv.ubicacion_id',
  });
  const conditions = ['bfv.deleted_at IS NULL', ...(scopeCondition ? [scopeCondition] : [])];
  const result = await executor.query(
    `SELECT DISTINCT creator.id, creator.usuario
     FROM bitacora_visit_form_versions bfv
     INNER JOIN usuarios creator ON creator.id = bfv.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY creator.usuario ASC, creator.id ASC`,
    params
  );
  return result.rows;
};

// Un formulario es la serie de versiones de una Urbanización: solo una
// versión puede estar ACTIVE a la vez (archiving + índice único parcial lo
// garantizan), pero puede haber historial ARCHIVED sin ninguna ACTIVE (por
// ejemplo tras archivar manualmente). Publicar en ese caso sigue siendo
// "editar" el mismo formulario, no crear uno nuevo, por lo que exige el
// mismo permiso que editar una versión activa.
const hasVisitFormHistory = async ({ client, locationId }) => {
  const result = await client.query(
    `SELECT id FROM bitacora_visit_form_versions
     WHERE ubicacion_id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [locationId]
  );
  return result.rowCount > 0;
};

const publishVisitFormForLocation = async ({
  client,
  locationId,
  title,
  showDateTime,
  tiposVisita,
  fields,
  groups = [],
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
  for (const [index, tipo] of tiposVisita.entries()) {
    const tipoResult = await client.query(
      `INSERT INTO bitacora_visit_form_tipos (form_version_id, nombre, requiere_salida, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [version.id, tipo.nombre, tipo.requiere_salida === true, index + 1]
    );
    tipoIdByName.set(tipo.nombre, tipoResult.rows[0].id);
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

  for (const [groupIndex, group] of groups.entries()) {
    const groupAplicaA = group.aplica_a === 'TODOS' ? 'TODOS' : 'SELECCIONADOS';
    const groupResult = await client.query(
      `INSERT INTO bitacora_visit_form_groups
        (form_version_id, group_key, label, min_count, aplica_a, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [version.id, group.group_key, group.label, group.min_count || 0, groupAplicaA, groupIndex + 1]
    );
    const groupId = groupResult.rows[0].id;

    if (groupAplicaA === 'SELECCIONADOS') {
      for (const tipoNombre of group.aplica_a) {
        await client.query(
          `INSERT INTO bitacora_visit_form_group_tipos (group_id, form_version_id, tipo_id)
           VALUES ($1, $2, $3)`,
          [groupId, version.id, tipoIdByName.get(tipoNombre)]
        );
      }
    }

    for (const [fieldIndex, groupField] of group.fields.entries()) {
      await client.query(
        `INSERT INTO bitacora_visit_form_group_fields
          (group_id, form_version_id, field_key, label, type, required, options, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          groupId,
          version.id,
          groupField.field_key,
          groupField.label,
          groupField.type,
          Boolean(groupField.required),
          JSON.stringify(groupField.options || []),
          fieldIndex + 1,
        ]
      );
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
       created_by, published_by, created_at, published_at, deleted_at
     FROM bitacora_visit_form_versions
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [formId]
  );
  return result.rows[0] || null;
};

const softDeleteVisitFormVersion = async ({ client, formId }) => {
  const result = await client.query(
    `UPDATE bitacora_visit_form_versions
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND estado = 'ARCHIVED' AND deleted_at IS NULL
     RETURNING id, ubicacion_id, version, titulo, estado, deleted_at`,
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
       ocurrido_at, detalle, origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'VISITA')
     RETURNING id, ubicacion_id, manzana_id, villa_id, autor_usuario_id, autor_colaborador_id,
               ocurrido_at, detalle, estado, origen, created_at`,
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
  estado = 'ABIERTA',
  motivoNoAutorizacion = null,
}) => {
  const result = await client.query(
    `INSERT INTO bitacora_visitas
      (ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
       visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa,
       registrado_por_usuario_id, registrado_por_colaborador_id, entrada_bitacora_registro_id,
       estado, motivo_no_autorizacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, ubicacion_id, manzana_id, villa_id, residente_principal_id, form_version_id,
       visitante_nombre, visitante_documento, visitante_telefono, tipo_visita_id, placa, estado, entrada_at,
       salida_at, registrado_por_usuario_id, registrado_por_colaborador_id,
       cerrado_por_usuario_id, cerrado_por_colaborador_id, entrada_bitacora_registro_id,
       salida_bitacora_registro_id, motivo_no_autorizacion, created_at, updated_at`,
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
      estado,
      motivoNoAutorizacion,
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

const insertVisitGroupResponses = async ({ client, visitId, formVersionId, groups, entries }) => {
  for (const group of groups) {
    const groupEntries = entries[group.group_key];
    if (!Array.isArray(groupEntries) || groupEntries.length === 0) {
      continue;
    }
    for (const [index, entry] of groupEntries.entries()) {
      const respuestas = group.fields
        .filter((field) => {
          const rawValue = entry[field.field_key];
          return rawValue !== undefined && rawValue !== null && rawValue !== '';
        })
        .map((field) => ({
          field_key: field.field_key,
          label: field.label,
          type: field.type,
          value: entry[field.field_key],
        }));
      await client.query(
        `INSERT INTO bitacora_visita_grupo_registros
          (visita_id, group_id, form_version_id, group_key_snapshot, label_snapshot, entry_index, respuestas)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          visitId,
          group.id,
          formVersionId,
          group.group_key,
          group.label,
          index + 1,
          JSON.stringify(respuestas),
        ]
      );
    }
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
      `(bv.visitante_nombre ILIKE $${searchIndex}
        OR bv.visitante_documento ILIKE $${searchIndex}
        OR bv.placa ILIKE $${searchIndex}
        OR m.nombre ILIKE $${searchIndex}
        OR v.identificador ILIKE $${searchIndex}
        OR regexp_replace(COALESCE(m.nombre, '') || COALESCE(v.identificador, ''), '\\s+', '', 'g')
          ILIKE regexp_replace($${searchIndex}, '\\s+', '', 'g')
        OR r.nombre ILIKE $${searchIndex}
        OR EXISTS (
          SELECT 1
          FROM bitacora_visita_grupo_registros search_group
          CROSS JOIN LATERAL jsonb_array_elements(search_group.respuestas) search_answer
          WHERE search_group.visita_id = bv.id
            AND search_answer->>'field_key' IN ('nombre', 'cedula')
            AND search_answer->>'value' ILIKE $${searchIndex}
        )
        OR EXISTS (
          SELECT 1
          FROM bitacora_visita_respuestas search_response
          WHERE search_response.visita_id = bv.id
            AND search_response.type_snapshot = 'placa'
            AND search_response.value_text ILIKE $${searchIndex}
        ))`
    );
  }
  return {
    params,
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
  };
};

const findVisits = async ({ filters, hasGlobalScope, userId, pagination, executor = db }) => {
  const { params, where } = buildVisitFilters({ filters, hasGlobalScope, userId });
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
       bv.tipo_visita_id, tv.nombre AS tipo_visita_nombre, tv.requiere_salida, bv.placa,
       bv.estado, bv.entrada_at, bv.salida_at, bv.motivo_no_autorizacion,
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
       ) AS respuestas,
       (
         SELECT COALESCE(jsonb_agg(gr.respuestas ORDER BY gr.entry_index), '[]'::jsonb)
         FROM bitacora_visita_grupo_registros gr
         WHERE gr.visita_id = bv.id
       ) AS visitantes,
       COUNT(*) OVER()::int AS total_count
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
       tv.nombre, tv.requiere_salida, u.usuario, c.nombres_completos, cu.usuario, cc.nombres_completos
     ORDER BY ${pagination.sortExpression || 'bv.entrada_at'} ${(pagination.sortOrder || 'desc').toUpperCase()} NULLS LAST,
       bv.id ${(pagination.sortOrder || 'desc').toUpperCase()}
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );
  const total = dataResult.rows[0]?.total_count || 0;
  const items = dataResult.rows.map(({ total_count: _totalCount, ...row }) => row);
  return { items, total };
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
       bv.visitante_nombre, bv.tipo_visita_id, tv.nombre AS tipo_visita_nombre,
       tv.requiere_salida, bv.placa,
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
  getBitacorasResumen,
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
  insertVisitGroupResponses,
  hasVisitFormHistory,
  findVisitFormVersionDetail,
  publishVisitFormForLocation,
  acquireVisitFormPublishLock,
  findLockedVisitFormVersion,
  archiveVisitFormVersion,
  softDeleteVisitFormVersion,
  createVisit,
  closeVisit,
  cancelVisit,
};
