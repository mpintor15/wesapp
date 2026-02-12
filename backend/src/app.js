const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const cuentasRoutes = require('./routes/cuentas.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const personalRoutes = require('./routes/personal.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

// ======================
// Middlewares de seguridad
// ======================

// Helmet para seguridad HTTP
app.use(helmet());

// CORS
app.use(cors(config.cors));

// Rate limiting (limitar peticiones por IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por windowMs
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde'
});

app.use('/api/', limiter);

// ======================
// Middlewares de parsing
// ======================

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ======================
// Logger simple (en desarrollo)
// ======================

if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// ======================
// Rutas
// ======================

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WESApp API is running',
    timestamp: new Date().toISOString()
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

// TODO: Agregar más rutas
app.use('/api/usuarios', usuariosRoutes);

// ======================
// Manejo de rutas no encontradas
// ======================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// ======================
// Manejo de errores global
// ======================

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

module.exports = app;
