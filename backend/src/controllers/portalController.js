/**
 * portalController.js — Portal de clientes (solo lectura).
 *
 * El alcance se deriva siempre del usuario autenticado (usuarios.cliente_id):
 * nunca se acepta un cliente o ubicación arbitraria desde la petición. Las
 * urbanizaciones fuera del cliente simplemente no devuelven filas.
 */
const db = require('../config/database');
const { createHttpError, handleControllerError } = require('../utils/http');
const { buildPaginationMetadata, normalizePaginationQuery } = require('../utils/pagination');
const {
  findVisits,
  findVisitCreators,
  findVisibleLocations,
} = require('../repositories/bitacorasRepository');
const { VISIT_SORTS, normalizeVisitFilters } = require('../modules/bitacoras/bitacoras.domain');

const assertClienteActivo = async (user) => {
  const clienteId = Number(user?.cliente_id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    throw createHttpError(403, 'Tu usuario no está asociado a un cliente');
  }
  const result = await db.query('SELECT estado FROM clientes WHERE id = $1', [clienteId]);
  if (result.rowCount === 0 || result.rows[0].estado !== 'activo') {
    throw createHttpError(403, 'El acceso de tu cliente no está disponible');
  }
  return clienteId;
};

const getUbicaciones = async (req, res) => {
  try {
    const clienteId = await assertClienteActivo(req.user);
    const data = await findVisibleLocations({
      hasGlobalScope: false,
      userId: req.user.id,
      clienteId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar urbanizaciones del portal');
  }
};

const getVisitas = async (req, res) => {
  try {
    const clienteId = await assertClienteActivo(req.user);
    const pagination = normalizePaginationQuery(req.query, {
      sortBy: 'entrada_at',
      allowedSorts: VISIT_SORTS,
    });
    const filters = normalizeVisitFilters(req.query);
    const scope = { hasGlobalScope: false, userId: req.user.id, clienteId };
    const [{ items, total }, creators] = await Promise.all([
      findVisits({ filters, pagination, ...scope }),
      findVisitCreators(scope),
    ]);
    const meta = buildPaginationMetadata({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: total,
    });
    return res.json({ success: true, data: items, meta, filters: { creators } });
  } catch (error) {
    return handleControllerError(res, error, 'Error al consultar visitas del portal');
  }
};

module.exports = { getUbicaciones, getVisitas };
