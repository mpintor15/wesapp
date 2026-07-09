/**
 * config.js — Configuración centralizada de la aplicación
 *
 * Carga variables de entorno desde .env y las expone en un objeto tipado.
 * En producción valida que todas las variables críticas estén definidas
 * y que JWT_SECRET no use el valor por defecto inseguro.
 *
 * Secciones:
 *  - port / nodeEnv      : Puerto del servidor y entorno de ejecución.
 *  - jwt                 : Secreto y expiración del token JWT (24h por defecto).
 *  - cors                : Origen(es) permitidos para peticiones cross-origin.
 *  - database            : Credenciales de conexión a PostgreSQL.
 *  - permissions         : Mapa de módulos accesibles por tipo de usuario:
 *      · gerente    → acceso total (incluye gestión de usuarios).
 *      · secretario → cuentas, inventario y personal (sin gestión de usuarios).
 *      · supervisor → inventario y personal (solo lectura/movimientos).
 *      · contador   → únicamente el módulo de cuentas.
 */
const path = require('path');
const dotenv = require('dotenv');

const envTarget = process.env.NODE_ENV === 'production' ? 'production' : 'development';
dotenv.config({
  path: path.resolve(__dirname, `../../.env.${envTarget}`),
});

const nodeEnv = process.env.NODE_ENV || 'development';
const parseBooleanEnv = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
const e2eMode = nodeEnv !== 'production' && parseBooleanEnv(process.env.E2E_MODE);

const parseCorsOrigin = (value) => {
  if (nodeEnv === 'development') {
    return (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost) {
        callback(null, true);
        return;
      }

      const allowedOrigins = (value || '')
        .split(',')
        .map((originValue) => originValue.trim())
        .filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    };
  }

  if (!value) {
    return '*';
  }
  if (value === '*') {
    return '*';
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length <= 1 ? origins[0] || '*' : origins;
};

const requireInProduction = (key) => {
  if (!process.env[key] || String(process.env[key]).trim() === '') {
    throw new Error(`[CONFIG] Missing required env var in production: ${key}`);
  }
};

if (nodeEnv === 'production') {
  requireInProduction('DB_HOST');
  requireInProduction('DB_PORT');
  requireInProduction('DB_NAME');
  requireInProduction('DB_USER');
  requireInProduction('DB_PASSWORD');
  requireInProduction('JWT_SECRET');
  requireInProduction('CORS_ORIGIN');

  if (process.env.JWT_SECRET === 'default_secret_change_this') {
    throw new Error('[CONFIG] JWT_SECRET cannot use the insecure default in production');
  }

  if (process.env.CORS_ORIGIN === '*') {
    throw new Error('[CONFIG] CORS_ORIGIN cannot be "*" in production');
  }
}

module.exports = {
  // Configuración del servidor
  port: process.env.PORT || 3000,
  nodeEnv,
  e2eMode,

  // Rate limits. E2E_MODE is ignored in production and exists only to keep
  // local Playwright suites from exhausting IP-based development buckets.
  rateLimits: {
    global: {
      windowMs: 15 * 60 * 1000,
      max: e2eMode ? 50_000 : nodeEnv === 'production' ? 300 : 2000,
    },
    login: {
      windowMs: 15 * 60 * 1000,
      max: e2eMode ? 2_000 : nodeEnv === 'production' ? 10 : 30,
    },
  },

  // Configuración de JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_this',
    expiration: process.env.JWT_EXPIRATION || '24h',
  },

  // Configuración de CORS
  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true,
  },

  // Configuración de base de datos
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  // Configuración de permisos por tipo de usuario
  permissions: {
    gerente: [
      'cuentas',
      'inventario',
      'personal',
      'usuarios',
      'crear_articulo',
      'eliminar_articulo',
      'dar_baja_articulo',
      'crear_movimiento',
      'exportar',
    ],
    secretario: [
      'cuentas',
      'inventario',
      'personal',
      'crear_articulo',
      'dar_baja_articulo',
      'crear_movimiento',
      'exportar',
    ],
    supervisor: [
      'inventario',
      'personal',
      'crear_articulo',
      'dar_baja_articulo',
      'crear_movimiento',
      'exportar',
    ],
    contador: ['cuentas', 'exportar'],
  },
};
