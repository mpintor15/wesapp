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
const { runMigrations } = require('./config/migrations');

const PORT = config.port;
let server;

// Verificar conexión a la base de datos antes de iniciar el servidor
const startServer = async () => {
  try {
    // Test de conexión a la base de datos
    await db.query('SELECT NOW()');
    console.log('✅ Conexión a PostgreSQL establecida');

    await runMigrations();
    console.log('✅ Migraciones de base de datos verificadas');
    
    // Iniciar servidor
    server = app.listen(PORT, () => {
      console.log(`Servidor WESApp corriendo en puerto ${PORT}`);
      console.log(`Ambiente: ${config.nodeEnv}`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`${signal} recibido, cerrando servidor...`);
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error durante cierre ordenado:', error);
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
  process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Iniciar el servidor
startServer();
