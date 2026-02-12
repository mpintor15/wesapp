require('dotenv').config();

module.exports = {
  // Configuración del servidor
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
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