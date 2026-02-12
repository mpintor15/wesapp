require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

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
  
  // Configuración de JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_this',
    expiration: process.env.JWT_EXPIRATION || '24h',
  },
  
  // Configuración de CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
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
      'crear_movimiento', 
      'exportar'
    ],
    secretario: [
      'cuentas', 
      'inventario', 
      'personal', 
      'crear_articulo', 
      'eliminar_articulo', 
      'crear_movimiento', 
      'exportar'
    ],
    supervisor: [
      'inventario', 
      'personal', 
      'crear_movimiento', 
      'exportar'
    ],
    contador: [
      'cuentas'
    ]
  }
};
