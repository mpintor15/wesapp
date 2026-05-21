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

const PORT = config.port;
let server;

// Verificar conexión a la base de datos antes de iniciar el servidor
const startServer = async () => {
  try {
    // Test de conexión a la base de datos
    await db.query('SELECT NOW()');
    console.log('✅ Conexión a PostgreSQL establecida');

    // Migración 011: tabla de bajas de artículos
    await db.query(`
      CREATE TABLE IF NOT EXISTS articulos_bajas (
        id SERIAL PRIMARY KEY,
        articulo_id INTEGER REFERENCES articulos(id) ON DELETE SET NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        motivo TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
        fecha_baja TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tipo_articulo VARCHAR(20),
        nombre_articulo VARCHAR(100),
        talla VARCHAR(10),
        marca VARCHAR(50),
        modelo VARCHAR(50),
        numero_serie VARCHAR(100),
        calibre VARCHAR(20),
        codigo_pantalla VARCHAR(50),
        codigo_radio VARCHAR(50),
        version VARCHAR(50),
        ubicacion_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
        ubicacion_nombre VARCHAR(100)
      )
    `);
    await db.query('CREATE INDEX IF NOT EXISTS idx_articulos_bajas_fecha ON articulos_bajas(fecha_baja)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_articulos_bajas_articulo ON articulos_bajas(articulo_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_articulos_bajas_usuario ON articulos_bajas(usuario_id)');
    console.log('✅ Migración 011 (articulos_bajas) verificada');
    
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
