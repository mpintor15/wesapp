/**
 * app.js — Configuración central de la aplicación Express
 *
 * Responsabilidades:
 *  - Aplica middlewares de seguridad: Helmet (cabeceras HTTP seguras),
 *    CORS (control de orígenes permitidos) y Rate Limiting (máx. 100
 *    peticiones por IP cada 15 minutos).
 *  - Parsea cuerpos JSON y URL-encoded en las peticiones.
 *  - Registra todas las rutas del API bajo el prefijo /api/.
 *  - Incluye un logger de peticiones en modo desarrollo.
 *  - Expone un endpoint de salud en GET /health.
 *  - En producción, sirve el build estático de React y redirige
 *    todas las rutas no-API a index.html (soporte de React Router).
 *  - Maneja errores de API (404/500) para rutas bajo /api/.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('node:path');
const config = require('./config/config');
const logger = require('./config/logger');
const httpLogger = require('./middleware/httpLogger');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const cuentasRoutes = require('./routes/cuentas.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const personalRoutes = require('./routes/personal.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

// Trust the first proxy (Railway / nginx sets X-Forwarded-For)
app.set('trust proxy', 1);

// ======================
// Middlewares de seguridad
// ======================

// Redirigir HTTP → HTTPS en producción (Railway pone x-forwarded-proto)
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Helmet para seguridad HTTP
app.use(helmet());

// CORS
app.use(cors(config.cors));

// Rate limiting (limitar peticiones por IP)
// Development: 2000 req/15 min to avoid false positives from hot-reloads and tooling
// Production : 300 req/15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 300 : 2000,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  // Always return JSON so the frontend can read the message correctly
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiadas peticiones. Espera unos minutos e intenta de nuevo.',
    });
  },
});

app.use('/api/', limiter);

// ======================
// Middlewares de parsing
// ======================

// Parse JSON bodies (1 MB limit to prevent oversized payloads)
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ======================
// HTTP Logging
// ======================
app.use(httpLogger);

// ======================
// Rutas
// ======================

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WESApp API is running',
    timestamp: new Date().toISOString(),
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de cuentas
app.use('/api/cuentas', cuentasRoutes);

// Rutas de inventario
app.use('/api/inventario', inventarioRoutes);

// Rutas de personal
app.use('/api/personal', personalRoutes);

// Rutas de usuarios
app.use('/api/usuarios', usuariosRoutes);

// ======================
// 404 para rutas /api/* no encontradas
// ======================

app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// ======================
// Servir frontend React (producción)
// ======================

if (config.nodeEnv === 'production') {
  // Ruta al build de React (relativa a este archivo)
  const buildPath = path.join(__dirname, '../../frontend/build');

  // Servir archivos estáticos del build (JS, CSS, imágenes, etc.)
  app.use(express.static(buildPath));

  // Cualquier ruta no-API devuelve index.html para que React Router la maneje
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// ======================
// Manejo de errores global
// ======================

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const level = status >= 500 ? 'error' : 'warn';
  logger[level](`${req.method} ${req.path} - Error`, {
    message: err.message,
    stack: err.stack,
    code: err.code,
    status,
  });

  res.status(status).json({
    success: false,
    message:
      status >= 500 && config.nodeEnv === 'production'
        ? 'Error interno del servidor'
        : err.message || 'Error interno del servidor',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
