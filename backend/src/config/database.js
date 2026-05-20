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
 * El pool está configurado con mín. 2 y máx. 20 conexiones simultáneas,
 * reciclando cada conexión tras 7.500 usos para prevenir memory leaks.
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

// Configuración del pool de conexiones PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,                  // SSL activado solo si DB_SSL=true
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Máximo de conexiones simultáneas
  min: parseInt(process.env.DB_POOL_MIN) || 2, // Mínimo de conexiones mantenidas
  idleTimeoutMillis: 30000, // Cerrar conexiones inactivas después de 30s
  connectionTimeoutMillis: 2000, // Timeout para obtener conexión del pool
  maxUses: 7500, // Reciclar conexión después de 7500 usos (previene memory leaks)
  allowExitOnIdle: false, // No cerrar el proceso si todas las conexiones están idle
});

// Evento cuando se conecta
pool.on('connect', () => {
  console.log('✅ Conectado a la base de datos PostgreSQL');
});

// Evento de error
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el cliente de PostgreSQL', err);
  process.exit(-1);
});

// Función helper para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      console.log('✅ Query ejecutado', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('❌ Error en query:', error);
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
