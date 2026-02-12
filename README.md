# WESApp - Sistema de Control de Cuentas por Cobrar

**Versión:** 2.0.0
**Estado:** ✅ Listo para Producción

---

## 🎯 Descripción

WESApp es una aplicación de escritorio (Electron) para la gestión de cuentas por cobrar, desarrollada específicamente para WES Security. Permite registrar facturas, gestionar pagos, aplicar retenciones e IVA, y generar reportes financieros.

### Características Principales

- ✅ Gestión de clientes
- ✅ Creación de facturas con cálculo automático de IVA y retenciones
- ✅ Registro de pagos (abonos)
- ✅ Anulación de facturas (soft delete)
- ✅ Reportes y exportación a Excel
- ✅ Auditoría completa de operaciones
- ✅ Multi-usuario con permisos
- ✅ Soporte para 50+ usuarios concurrentes

---

## 🏗️ Arquitectura

```
Frontend (Electron + React)
         ↓
Backend (Node.js + Express)
         ↓
PostgreSQL Database
```

### Stack Tecnológico

**Frontend:**
- React 18
- Electron 28
- Axios
- CSS personalizado

**Backend:**
- Node.js
- Express 4
- PostgreSQL
- JWT para autenticación
- ExcelJS para reportes

---

## 📋 Requisitos

- Node.js 16+
- PostgreSQL 13+
- npm 8+

---

## 🚀 Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <tu-repositorio>
cd WesApp
```

### 2. Configurar Base de Datos

```bash
# Crear base de datos
createdb -U postgres wesapp

# Ejecutar schema
psql -U postgres -d wesapp -f database/schema.sql

# Aplicar migraciones
cd backend
node src/utils/migrationRunner.js run
```

### 3. Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.production.example .env

# Generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copiar el resultado y pegarlo en .env como JWT_SECRET

# Editar .env con tus valores
nano .env
```

**Configuración mínima de .env:**
```env
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=wesapp
DB_USER=postgres
DB_PASSWORD=tu_password

JWT_SECRET=tu_secreto_generado_arriba
JWT_EXPIRATION=24h

CORS_ORIGIN=*
```

### 4. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear .env.production
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env.production
```

---

## 🎮 Uso

### Desarrollo

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Producción

**Opción 1: Desktop App (Electron)**
```bash
cd frontend
npm run electron-pack
# Los ejecutables estarán en dist/
```

**Opción 2: Backend en servidor con PM2**
```bash
cd backend
npm install --production

# Iniciar con PM2
pm2 start src/server.js --name wesapp-backend
pm2 save
pm2 startup
```

---

## 📊 Cálculos de Impuestos

El sistema calcula automáticamente:

- **IVA**: 15% del subtotal (si está marcado)
- **Retención de Fuente**: 2.75% del subtotal (si está marcada)
- **Retención de IVA**: 70% del IVA (si está marcada y hay IVA)
- **Por Cobrar**: Subtotal + IVA - Ret.Fuente - Ret.IVA
- **Saldo Pendiente**: Por Cobrar - Total Abonos

**Ejemplo:**
```
Subtotal:           $1,000.00
IVA (15%):            $150.00
Ret. Fuente (2.75%):  $27.50
Ret. IVA (70%):       $105.00
─────────────────────────────
Por Cobrar:        $1,017.50
```

---

## 🗄️ Estructura de Base de Datos

### Tablas Principales

- **usuarios** - Usuarios del sistema con permisos
- **clientes** - Clientes de la empresa
- **cuentas** - Facturas emitidas
- **abonos** - Pagos recibidos
- **retenciones** - Retenciones aplicadas (legacy)
- **audit_log** - Registro de auditoría

### Vista Principal

- **vista_reporte_cuentas** - Vista con todos los cálculos

---

## 🔐 Seguridad

- ✅ Autenticación JWT
- ✅ Passwords hasheados (bcrypt)
- ✅ SQL injection prevention (queries parametrizadas)
- ✅ CORS configurable
- ✅ Prevención de double-submit
- ✅ Validación en frontend y backend
- ✅ Constraints de integridad en DB
- ✅ Auditoría completa de operaciones

---

## 🛠️ Comandos Útiles

### Migraciones

```bash
# Ver estado
node backend/src/utils/migrationRunner.js status

# Ejecutar pendientes
node backend/src/utils/migrationRunner.js run
```

### Base de Datos

```bash
# Backup
pg_dump -U postgres wesapp > backup.sql

# Restore
psql -U postgres wesapp < backup.sql

# Conectar
psql -U postgres wesapp
```

### PM2

```bash
# Ver logs
pm2 logs wesapp-backend

# Monitorear
pm2 monit

# Reiniciar
pm2 restart wesapp-backend

# Detener
pm2 stop wesapp-backend
```

---

## 📈 Performance

- **Índices optimizados** - Queries 3-6x más rápidos
- **Pool de conexiones** - Soporta 50+ usuarios concurrentes
- **Vistas materializadas** - Dashboards instantáneos
- **Caché de queries** - Reducción de carga en DB

---

## 🐛 Troubleshooting

### Backend no inicia

```bash
# Ver logs
pm2 logs wesapp-backend

# Verificar .env
cat backend/.env

# Probar DB
psql -U postgres -d wesapp -c "SELECT 1;"
```

### No se puede conectar a DB

```bash
# Verificar PostgreSQL corriendo
sudo systemctl status postgresql  # Linux
brew services list               # macOS

# Verificar credenciales
psql -U postgres -h localhost -d wesapp
```

### Error de CORS

```bash
# Verificar CORS_ORIGIN en backend/.env
# Debe incluir el origin del frontend
```

---

## 📝 Usuario Por Defecto

**Usuario:** MPinto
**Tipo:** gerente
**Password:** Configurar en primer login

---

## 🔄 Actualizaciones

```bash
# Pull cambios
git pull origin main

# Backend
cd backend
npm install
node src/utils/migrationRunner.js run
pm2 restart wesapp-backend

# Frontend (rebuild)
cd frontend
npm install
npm run electron-pack
```

---

## 📞 Soporte

Para problemas o preguntas:

1. Revisar logs: `pm2 logs wesapp-backend`
2. Verificar health: `curl http://localhost:3000/health`
3. Consultar documentación en `docs/` (si existe)

---

## 📄 Licencia

Uso interno de WES Security.

---

## 🎉 Créditos

Desarrollado para WES Security
**Versión 2.0.0** - Febrero 2026

---

**¡La aplicación está lista para producción!** 🚀
