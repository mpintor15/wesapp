const db = require('../config/database');
const logger = require('../config/logger');
const { sanitizeError } = require('../utils/logSanitizer');
const { parseStrictPositiveInteger } = require('../utils/inputValidation');
const { logAuditStrict, auditFromReq } = require('../utils/audit');

const RESIDENT_CONTACT_PATTERN = /^09[0-9]{8}$/;
const RESIDENT_CONTACT_ERROR = 'El contacto debe tener exactamente 10 dígitos y comenzar por 09.';

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const parseId = (value, message) => {
  const result = parseStrictPositiveInteger(value, message);
  if (!result.valid) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  return result.value;
};

const validateText = (value, label) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    const error = new Error(`${label} es obligatorio`);
    error.status = 400;
    throw error;
  }
  if (normalized.length > 100) {
    const error = new Error(`${label} no puede exceder 100 caracteres`);
    error.status = 400;
    throw error;
  }
  return normalized;
};

const validateResidentText = (value, label) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw appError(400, 'INVALID_RESIDENT', `${label} es obligatorio`);
  }
  if (normalized.length > 150) {
    throw appError(400, 'INVALID_RESIDENT', `${label} no puede exceder 150 caracteres`);
  }
  return normalized;
};

const validateResidentContact = (value) => {
  const contacto = typeof value === 'string' ? value : '';
  if (!RESIDENT_CONTACT_PATTERN.test(contacto)) {
    throw appError(400, 'INVALID_RESIDENT_CONTACT', RESIDENT_CONTACT_ERROR);
  }
  return contacto;
};

const validateEstado = (value, fallback = 'activo') => {
  const estado = value === undefined ? fallback : normalizeText(value).toLowerCase();
  if (!['activo', 'inactivo'].includes(estado)) {
    const error = new Error('El estado debe ser activo o inactivo');
    error.status = 400;
    throw error;
  }
  return estado;
};

const appError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.appCode = code;
  return error;
};

const sendError = (res, error, fallback) => {
  logger.error(fallback, { error: sanitizeError(error) });
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_MASTER',
      message: 'Ya existe un registro equivalente dentro del mismo padre.',
    });
  }
  if (error.code === '23514' || error.code === '23503') {
    return res.status(409).json({
      success: false,
      code: 'INVALID_MASTER_CHAIN',
      message: 'La operación no respeta la cadena activa de Urbanización.',
    });
  }
  return res.status(error.status || 500).json({
    success: false,
    ...(error.appCode ? { code: error.appCode } : {}),
    message: error.status ? error.message : 'Error en el servidor',
  });
};

const getUrbanizacion = async (executor, ubicacionId, lock = '') => {
  const result = await executor.query(
    `SELECT id, nombre, tipo_punto FROM ubicaciones WHERE id = $1 ${lock}`,
    [ubicacionId]
  );
  if (result.rowCount === 0) {
    throw appError(404, 'LOCATION_NOT_FOUND', 'Ubicación no encontrada');
  }
  if (result.rows[0].tipo_punto !== 'URBANIZACION') {
    throw appError(
      409,
      'LOCATION_NOT_URBANIZATION',
      'Solo una ubicación de tipo Urbanización puede administrar Manzanas.'
    );
  }
  return result.rows[0];
};

const getManzana = async (executor, manzanaId, lock = '') => {
  const result = await executor.query(
    `SELECT m.id, m.ubicacion_id, m.nombre, m.estado, u.tipo_punto
     FROM manzanas m
     JOIN ubicaciones u ON u.id = m.ubicacion_id
     WHERE m.id = $1 ${lock}`,
    [manzanaId]
  );
  if (result.rowCount === 0) {
    throw appError(404, 'BLOCK_NOT_FOUND', 'Manzana no encontrada');
  }
  return result.rows[0];
};

const getVilla = async (executor, villaId, lock = '') => {
  const result = await executor.query(
    `SELECT v.id, v.manzana_id, v.identificador, v.estado,
            m.estado AS manzana_estado, m.ubicacion_id, u.tipo_punto
     FROM villas v
     JOIN manzanas m ON m.id = v.manzana_id
     JOIN ubicaciones u ON u.id = m.ubicacion_id
     WHERE v.id = $1 ${lock}`,
    [villaId]
  );
  if (result.rowCount === 0) {
    throw appError(404, 'VILLA_NOT_FOUND', 'Villa no encontrada');
  }
  return result.rows[0];
};

const getVillaForUpdate = async (executor, villaId) => {
  const blockResult = await executor.query(
    `SELECT m.id
     FROM manzanas m
     WHERE m.id = (SELECT v.manzana_id FROM villas v WHERE v.id = $1)
     FOR UPDATE OF m`,
    [villaId]
  );
  if (blockResult.rowCount === 0) {
    throw appError(404, 'VILLA_NOT_FOUND', 'Villa no encontrada');
  }

  const villa = await getVilla(executor, villaId, 'FOR UPDATE OF v');
  if (villa.manzana_id !== blockResult.rows[0].id) {
    throw appError(409, 'INVALID_MASTER_CHAIN', 'La Villa dejó de pertenecer a la Manzana.');
  }
  return villa;
};

const getResidentePrincipalForUpdate = async (executor, residenteId) => {
  // Step 1: Discover villa_id by reading Resident WITHOUT lock.
  // This accepts temporary TOCTOU risk, but we'll re-validate after acquiring parent locks.
  const reference = await executor.query(
    `SELECT villa_id FROM residentes
     WHERE id = $1 AND es_principal = TRUE`,
    [residenteId]
  );
  if (reference.rowCount === 0) {
    throw appError(404, 'RESIDENT_NOT_FOUND', 'Residente principal no encontrado');
  }
  const villaId = reference.rows[0].villa_id;

  // Step 2: Lock parents in CANONICAL ORDER: Block → Villa
  // This prevents deadlock cycles with other transactions that lock Resident first.
  const villa = await getVillaForUpdate(executor, villaId);

  // Step 3: Lock Resident and re-validate relationships (TOCTOU check).
  // We now know villa_id and have Block/Villa locks, so we can safely lock Resident.
  const currentResult = await executor.query(
    `SELECT id, villa_id, nombre, contacto, activo FROM residentes
     WHERE id = $1 AND es_principal = TRUE FOR UPDATE`,
    [residenteId]
  );
  if (currentResult.rowCount === 0) {
    throw appError(404, 'RESIDENT_NOT_FOUND', 'Residente principal no encontrado');
  }
  const current = currentResult.rows[0];

  // Step 4: Verify relationships haven't changed during the lock acquisition.
  // If they have, we may retry from step 1 (rare case).
  if (current.villa_id !== villa.id) {
    throw appError(409, 'INVALID_MASTER_CHAIN', 'El Residente dejó de pertenecer a la Villa.');
  }
  return { current, villa };
};

const ensureActiveVillaChain = (villa) => {
  if (
    villa.estado !== 'activo' ||
    villa.manzana_estado !== 'activo' ||
    villa.tipo_punto !== 'URBANIZACION'
  ) {
    throw appError(
      409,
      'VILLA_CHAIN_INACTIVE',
      'La Villa, su Manzana y su Urbanización deben estar activas.'
    );
  }
};

const listManzanas = async (req, res) => {
  try {
    const ubicacionId = parseId(req.params.ubicacionId, 'La ubicación es inválida');
    await getUrbanizacion(db, ubicacionId);
    const result = await db.query(
      `SELECT m.id, m.ubicacion_id, m.nombre, m.estado, m.created_at, m.updated_at,
              COUNT(v.id) FILTER (WHERE v.estado = 'activo')::int AS villas_activas,
              COUNT(v.id)::int AS villas_totales
       FROM manzanas m
       LEFT JOIN villas v ON v.manzana_id = m.id
       WHERE m.ubicacion_id = $1
       GROUP BY m.id
       ORDER BY CASE WHEN m.estado = 'activo' THEN 0 ELSE 1 END, m.nombre, m.id`,
      [ubicacionId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error, 'Error al listar Manzanas');
  }
};

const createManzana = async (req, res) => {
  try {
    const ubicacionId = parseId(req.params.ubicacionId, 'La ubicación es inválida');
    const nombre = validateText(req.body?.nombre, 'El nombre de la Manzana');
    const created = await db.transaction(async (client) => {
      await getUrbanizacion(client, ubicacionId, 'FOR SHARE');
      const result = await client.query(
        `INSERT INTO manzanas (ubicacion_id, nombre, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, ubicacion_id, nombre, estado, created_at, updated_at`,
        [ubicacionId, nombre, req.user.id]
      );
      return result.rows[0];
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return sendError(res, error, 'Error al crear Manzana');
  }
};

const updateManzana = async (req, res) => {
  try {
    const manzanaId = parseId(req.params.manzanaId, 'La Manzana es inválida');
    const updated = await db.transaction(async (client) => {
      const current = await getManzana(client, manzanaId, 'FOR UPDATE OF m');
      const nombre = Object.prototype.hasOwnProperty.call(req.body || {}, 'nombre')
        ? validateText(req.body.nombre, 'El nombre de la Manzana')
        : current.nombre;
      const estado = validateEstado(req.body?.estado, current.estado);
      if (estado === 'activo') {
        await getUrbanizacion(client, current.ubicacion_id, 'FOR SHARE');
      }
      if (current.estado === 'activo' && estado === 'inactivo') {
        const activeVillas = await client.query(
          'SELECT 1 FROM villas WHERE manzana_id = $1 AND estado = $2 LIMIT 1',
          [manzanaId, 'activo']
        );
        if (activeVillas.rowCount > 0) {
          throw appError(
            409,
            'BLOCK_HAS_ACTIVE_VILLAS',
            'No se puede desactivar la Manzana mientras tenga Villas activas.'
          );
        }
      }
      const result = await client.query(
        `UPDATE manzanas SET nombre = $1, estado = $2 WHERE id = $3
         RETURNING id, ubicacion_id, nombre, estado, created_at, updated_at`,
        [nombre, estado, manzanaId]
      );
      return result.rows[0];
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendError(res, error, 'Error al actualizar Manzana');
  }
};

const deleteManzana = async (req, res) => {
  try {
    const manzanaId = parseId(req.params.manzanaId, 'La Manzana es inválida');
    const deleted = await db.transaction(async (client) => {
      const current = await getManzana(client, manzanaId, 'FOR UPDATE OF m');
      const villas = await client.query('SELECT 1 FROM villas WHERE manzana_id = $1 LIMIT 1', [
        manzanaId,
      ]);
      if (villas.rowCount > 0) {
        throw appError(
          409,
          'BLOCK_HAS_VILLAS',
          'No se puede eliminar la Manzana porque tiene Villas registradas.'
        );
      }
      await client.query('DELETE FROM manzanas WHERE id = $1', [manzanaId]);
      await logAuditStrict(client, {
        tabla: 'manzanas',
        operacion: 'DELETE',
        registro_id: manzanaId,
        datos_anteriores: current,
        ...auditFromReq(req),
      });
      return current;
    });
    return res.json({ success: true, message: 'Manzana eliminada exitosamente', data: deleted });
  } catch (error) {
    return sendError(res, error, 'Error al eliminar Manzana');
  }
};

const listVillas = async (req, res) => {
  try {
    const manzanaId = parseId(req.params.manzanaId, 'La Manzana es inválida');
    await getManzana(db, manzanaId);
    const result = await db.query(
      `SELECT id, manzana_id, identificador, estado, created_at, updated_at
       FROM villas WHERE manzana_id = $1
       ORDER BY CASE WHEN estado = 'activo' THEN 0 ELSE 1 END, identificador, id`,
      [manzanaId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return sendError(res, error, 'Error al listar Villas');
  }
};

const createVilla = async (req, res) => {
  try {
    const manzanaId = parseId(req.params.manzanaId, 'La Manzana es inválida');
    const identificador = validateText(req.body?.identificador, 'El identificador de la Villa');
    const created = await db.transaction(async (client) => {
      const manzana = await getManzana(client, manzanaId, 'FOR UPDATE OF m');
      if (manzana.estado !== 'activo') {
        throw appError(409, 'BLOCK_INACTIVE', 'La Manzana debe estar activa para crear Villas.');
      }
      await getUrbanizacion(client, manzana.ubicacion_id, 'FOR SHARE');
      const result = await client.query(
        `INSERT INTO villas (manzana_id, identificador, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, manzana_id, identificador, estado, created_at, updated_at`,
        [manzanaId, identificador, req.user.id]
      );
      return result.rows[0];
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return sendError(res, error, 'Error al crear Villa');
  }
};

const updateVilla = async (req, res) => {
  try {
    const villaId = parseId(req.params.villaId, 'La Villa es inválida');
    const updated = await db.transaction(async (client) => {
      const current = await getVillaForUpdate(client, villaId);
      const identificador = Object.prototype.hasOwnProperty.call(req.body || {}, 'identificador')
        ? validateText(req.body.identificador, 'El identificador de la Villa')
        : current.identificador;
      const estado = validateEstado(req.body?.estado, current.estado);
      if (current.estado === 'activo' && estado === 'inactivo') {
        const activeResident = await client.query(
          `SELECT 1 FROM residentes
           WHERE villa_id = $1 AND es_principal = TRUE AND activo = TRUE LIMIT 1`,
          [villaId]
        );
        if (activeResident.rowCount > 0) {
          throw appError(
            409,
            'VILLA_HAS_ACTIVE_RESIDENT',
            'No se puede desactivar la Villa mientras tenga Residente principal activo.'
          );
        }
      }
      if (estado === 'activo') {
        if (current.manzana_estado !== 'activo') {
          throw appError(
            409,
            'BLOCK_INACTIVE',
            'La Manzana debe estar activa para reactivar Villas.'
          );
        }
        await getUrbanizacion(client, current.ubicacion_id, 'FOR SHARE');
      }
      const result = await client.query(
        `UPDATE villas SET identificador = $1, estado = $2 WHERE id = $3
         RETURNING id, manzana_id, identificador, estado, created_at, updated_at`,
        [identificador, estado, villaId]
      );
      return result.rows[0];
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendError(res, error, 'Error al actualizar Villa');
  }
};

const deleteVilla = async (req, res) => {
  try {
    const villaId = parseId(req.params.villaId, 'La Villa es inválida');
    const deleted = await db.transaction(async (client) => {
      const current = await getVillaForUpdate(client, villaId);
      const residentes = await client.query(
        'SELECT 1 FROM residentes WHERE villa_id = $1 LIMIT 1',
        [villaId]
      );
      if (residentes.rowCount > 0) {
        throw appError(
          409,
          'VILLA_HAS_RESIDENTS',
          'No se puede eliminar la Villa porque tiene Residentes registrados.'
        );
      }
      await client.query('DELETE FROM villas WHERE id = $1', [villaId]);
      await logAuditStrict(client, {
        tabla: 'villas',
        operacion: 'DELETE',
        registro_id: villaId,
        datos_anteriores: current,
        ...auditFromReq(req),
      });
      return current;
    });
    return res.json({ success: true, message: 'Villa eliminada exitosamente', data: deleted });
  } catch (error) {
    return sendError(res, error, 'Error al eliminar Villa');
  }
};

const getResidentePrincipal = async (req, res) => {
  try {
    const villaId = parseId(req.params.villaId, 'La Villa es inválida');
    await getVilla(db, villaId);
    const result = await db.query(
      `SELECT id, villa_id, nombre, contacto, es_principal, activo, created_at, updated_at
       FROM residentes WHERE villa_id = $1 AND es_principal = TRUE
       ORDER BY activo DESC, created_at DESC, id DESC LIMIT 1`,
      [villaId]
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    return sendError(res, error, 'Error al consultar Residente principal');
  }
};

const createResidentePrincipal = async (req, res) => {
  try {
    const villaId = parseId(req.params.villaId, 'La Villa es inválida');
    const nombre = validateResidentText(req.body?.nombre, 'El nombre');
    const contacto = validateResidentContact(req.body?.contacto);
    const reemplazar = req.body?.reemplazar === true;
    const created = await db.transaction(async (client) => {
      const villa = await getVillaForUpdate(client, villaId);
      ensureActiveVillaChain(villa);
      const current = await client.query(
        `SELECT id FROM residentes
         WHERE villa_id = $1 AND es_principal = TRUE AND activo = TRUE FOR UPDATE`,
        [villaId]
      );
      if (current.rowCount > 0 && !reemplazar) {
        throw appError(409, 'ACTIVE_RESIDENT_EXISTS', 'La Villa ya tiene Residente principal.');
      }
      if (current.rowCount > 0) {
        await client.query('UPDATE residentes SET activo = FALSE WHERE id = $1', [
          current.rows[0].id,
        ]);
      }
      const result = await client.query(
        `INSERT INTO residentes (villa_id, nombre, contacto, es_principal, activo, created_by)
         VALUES ($1, $2, $3, TRUE, TRUE, $4)
         RETURNING id, villa_id, nombre, contacto, es_principal, activo, created_at, updated_at`,
        [villaId, nombre, contacto, req.user.id]
      );
      return result.rows[0];
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return sendError(res, error, 'Error al crear Residente principal');
  }
};

const updateResidentePrincipal = async (req, res) => {
  try {
    const residenteId = parseId(req.params.residenteId, 'El Residente es inválido');
    const hasNombre = Object.prototype.hasOwnProperty.call(req.body || {}, 'nombre');
    const hasContacto = Object.prototype.hasOwnProperty.call(req.body || {}, 'contacto');
    const nombreInput = hasNombre ? validateResidentText(req.body.nombre, 'El nombre') : undefined;
    const contactoInput = hasContacto ? validateResidentContact(req.body.contacto) : undefined;
    if (req.body?.activo !== undefined && typeof req.body.activo !== 'boolean') {
      throw appError(400, 'INVALID_RESIDENT', 'El estado activo es inválido');
    }
    const updated = await db.transaction(async (client) => {
      const { current, villa } = await getResidentePrincipalForUpdate(client, residenteId);
      const nombre = hasNombre ? nombreInput : current.nombre;
      const contacto = hasContacto ? contactoInput : current.contacto;
      let activo = current.activo;
      if (req.body?.activo !== undefined) {
        activo = req.body.activo;
      }
      if (activo) {
        ensureActiveVillaChain(villa);
      }
      const result = await client.query(
        `UPDATE residentes SET nombre = $1, contacto = $2, activo = $3 WHERE id = $4
         RETURNING id, villa_id, nombre, contacto, es_principal, activo, created_at, updated_at`,
        [nombre, contacto, activo, residenteId]
      );
      return result.rows[0];
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendError(res, error, 'Error al actualizar Residente principal');
  }
};

module.exports = {
  listManzanas,
  createManzana,
  updateManzana,
  deleteManzana,
  listVillas,
  createVilla,
  updateVilla,
  deleteVilla,
  getResidentePrincipal,
  createResidentePrincipal,
  updateResidentePrincipal,
  lockVillaChainForUpdate: getVillaForUpdate,
  lockResidentChainForUpdate: getResidentePrincipalForUpdate,
};
