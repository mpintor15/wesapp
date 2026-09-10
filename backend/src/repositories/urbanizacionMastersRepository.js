const db = require('../config/database');

const findManzanasByUbicacion = (ubicacionId, executor = db) =>
  executor.query(
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

const findVillasByManzana = (manzanaId, executor = db) =>
  executor.query(
    `SELECT id, manzana_id, identificador, estado, created_at, updated_at
     FROM villas WHERE manzana_id = $1
     ORDER BY CASE WHEN estado = 'activo' THEN 0 ELSE 1 END, identificador, id`,
    [manzanaId]
  );

const findResidentePrincipalByVilla = (villaId, executor = db) =>
  executor.query(
    `SELECT id, villa_id, nombre, contacto, es_principal, activo, created_at, updated_at
     FROM residentes WHERE villa_id = $1 AND es_principal = TRUE
     ORDER BY activo DESC, created_at DESC, id DESC LIMIT 1`,
    [villaId]
  );

module.exports = {
  findManzanasByUbicacion,
  findVillasByManzana,
  findResidentePrincipalByVilla,
};
