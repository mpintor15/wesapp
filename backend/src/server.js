/**
 * server.js — Punto de entrada del servidor
 *
 * Responsabilidades:
 *  - Verifica la conexión a PostgreSQL antes de arrancar.
 *  - Levanta el servidor HTTP en el puerto configurado (default 3000).
 *  - Maneja señales de sistema (SIGTERM) para un cierre ordenado.
 *  - Captura promesas no manejadas y termina el proceso con código de error.
 */
const app = require('./app');
const config = require('./config/config');
const db = require('./config/database');
const logger = require('./config/logger');
const { runMigrations } = require('./config/migrations');
const movementPdfStorage = require('./utils/movementPdfStorage');
const { sanitizeError } = require('./utils/logSanitizer');

const PORT = config.port;
let server;

// Verificar conexión a la base de datos antes de iniciar el servidor
const startServer = async () => {
  try {
    // Test de conexión a la base de datos
    await db.query('SELECT NOW()');
    logger.info('✅ Conexión a PostgreSQL establecida');

    await runMigrations();
    logger.info('✅ Migraciones de base de datos verificadas');

    await movementPdfStorage.ensureReady();
    logger.info('✅ Storage de PDFs verificado');

    // Iniciar servidor
    server = app.listen(PORT, () => {
      logger.info(`Servidor WESApp corriendo en puerto ${PORT}`);
      logger.info(`Ambiente: ${config.nodeEnv}`);
      logger.info(`URL: http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Error al iniciar servidor:', sanitizeError(error));
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.warn(`${signal} recibido, cerrando servidor...`);
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error durante cierre ordenado:', sanitizeError(error));
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  logger.error('❌ Error no manejado:', sanitizeError(err));
  process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Iniciar el servidor
startServer();
