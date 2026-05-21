/**
 * database.js — Configuración y helpers del pool de conexiones PostgreSQL
 *
 * Funcionalidades expuestas:
 *  - query(text, params)   : Ejecuta una consulta SQL y devuelve el resultado.
 *                            En desarrollo registra duración y filas afectadas.
 *  - transaction(callback) : Ejecuta una función dentro de una transacción
 *                            BEGIN/COMMIT; hace ROLLBACK automático si hay error.
 *  - getClient()           : Obtiene un cliente del pool para operaciones manuales.
 *                            Avisa si el cliente se retiene más de 5 segundos.
 *  - getPoolStats()        : Retorna métricas del pool (total, idle, waiting).
 *  - healthCheck()         : Verifica la conectividad y retorna la versión de PG.
 *  - close()               : Cierra todas las conexiones del pool limpiamente.
 *
 * En producción el pool usa valores conservadores para no agotar límites de
 * Railway/PostgreSQL cuando hay reinicios, health checks o varias réplicas.
 */
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

const envTarget = process.env.NODE_ENV === 'production' ? 'production' : 'development';
dotenv.config({
  path: path.resolve(__dirname, `../../.env.${envTarget}`)
});

// SSL: requerido para bases de datos en la nube como Neon (DB_SSL=true en producción)
const sslConfig = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: true } // Neon usa certificados públicos válidos — validar siempre
  : false;                        // Sin SSL para desarrollo local

const parsePoolInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';
const poolMax = parsePoolInt(process.env.DB_POOL_MAX, isProduction ? 5 : 10);
const poolMin = parsePoolInt(process.env.DB_POOL_MIN, 0);
const connectionTimeoutMillis = parsePoolInt(process.env.DB_CONNECTION_TIMEOUT_MS, 5000);
const idleTimeoutMillis = parsePoolInt(process.env.DB_IDLE_TIMEOUT_MS, isProduction ? 10000 : 30000);
const slowQueryThresholdMs = parsePoolInt(process.env.DB_SLOW_QUERY_MS, isProduction ? 1000 : 300);

// Configuración del pool de conexiones PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,                  // SSL activado solo si DB_SSL=true
  max: Math.max(poolMax, 1), // Máximo de conexiones simultáneas
  min: Math.min(poolMin, Math.max(poolMax, 1)), // No mantener conexiones si Railway las recicla
  idleTimeoutMillis,
  connectionTimeoutMillis,
  maxUses: 7500, // Reciclar conexión después de 7500 usos (previene memory leaks)
  allowExitOnIdle: false,
});

// Evento cuando se conecta
pool.on('connect', () => {
  if (!isProduction) {
    console.log('✅ Conectado a la base de datos PostgreSQL');
  }
});

// Evento de error
pool.on('error', (err) => {
  // pg ya retira del pool el cliente idle que falló. En Railway/DBaaS esto puede
  // pasar durante reinicios breves; matar el proceso entero provoca caídas visibles.
  console.error('❌ Error inesperado en un cliente idle de PostgreSQL', {
    message: err.message,
    code: err.code
  });
});

// Función helper para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (!isProduction && duration >= slowQueryThresholdMs) {
      console.log('✅ Query ejecutado', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('❌ Error en query:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      pool: getPoolStats()
    });
    throw error;
  }
};

// Función para obtener un cliente del pool (para transacciones)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  
  const timeout = setTimeout(() => {
    console.error('❌ Cliente ha estado checked out por más de 5 segundos');
  }, 5000);
  
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  
  return client;
};

// Función para ejecutar transacciones
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Función para obtener estadísticas del pool
const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: Math.max(poolMax, 1),
  };
};

// Función para cerrar el pool
const close = async () => {
  await pool.end();
  console.log('Pool de conexiones cerrado');
};

// Health check para verificar conexión a la base de datos
const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    return {
      healthy: true,
      timestamp: result.rows[0].current_time,
      version: result.rows[0].pg_version,
      pool: getPoolStats()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
};

module.exports = {
  query,
  getClient,
  transaction,
  getPoolStats,
  healthCheck,
  close,
  pool
};
