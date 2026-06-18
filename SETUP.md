# 🔧 Guía de Configuración del Entorno - WESApp

Esta guía te ayudará a configurar WESApp en tu máquina para desarrollo.

## 📋 Requisitos Previos

Verifica que tengas instalado:

```bash
# Node.js (≥18.0.0)
node --version
# Output: v18.x.x or higher

# npm (≥9.0.0)
npm --version
# Output: 9.x.x or higher

# PostgreSQL (≥12)
psql --version
# Output: psql (PostgreSQL) 12.x or higher
```

Si no tienes alguno instalado:
- **Node.js:** https://nodejs.org/ (descargar LTS)
- **PostgreSQL:** https://www.postgresql.org/download/
  - **macOS:** `brew install postgresql`
  - **Windows:** PostgreSQL installer (pgAdmin incluido)
  - **Linux:** `sudo apt-get install postgresql`

---

## 📦 Paso 1: Clonar y Preparar Repositorio

```bash
# Clonar
git clone <tu-repo-url>
cd wesapp

# Ver rama actual (debería ser 'main' o 'develop')
git status
```

---

## 🗄️ Paso 2: Configurar Base de Datos

### Opción A: PostgreSQL en Terminal

```bash
# 1. Conectar como superuser
psql -U postgres

# 2. Dentro de psql, ejecutar:
CREATE DATABASE wesapp;
\q

# 3. Verificar que la BD existe
psql -U postgres -d wesapp -c "SELECT version();"
```

### Opción B: PostgreSQL GUI (recomendado para Windows)

1. Abre **pgAdmin** (incluido en PostgreSQL installer)
2. Click derecho en "Databases" → "Create" → "Database"
3. Nombre: `wesapp`
4. Click "Save"

### Opción C: Docker (si tienes Docker instalado)

```bash
# Levantar PostgreSQL en container
docker run --name wesapp-db \
  -e POSTGRES_PASSWORD=change_this_password \
  -e POSTGRES_DB=wesapp \
  -p 5432:5432 \
  -d postgres:15

# Verificar
docker ps | grep wesapp-db
```

---

## ⚙️ Paso 3: Variables de Entorno

### Backend

```bash
cd backend

# Copiar template
cp .env.example .env.development

# Editar .env.development con tus credenciales
nano .env.development
# (o usa tu editor favorito: code, vim, etc)
```

**Contenido de backend/.env.development:**
```ini
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wesapp
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_SSL=false
JWT_SECRET=change_this_secret
JWT_EXPIRATION=24h
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**Nota:** 
- `DB_USER` y `DB_PASSWORD` son tus credenciales de PostgreSQL
- En macOS con Homebrew, el rol de PostgreSQL puede variar según la instalación. Verifica tus roles con `psql postgres` o crea un rol/usuario específico para WESApp.
- En Windows, define el usuario y contraseña que configuraste durante la instalación

### Frontend

```bash
cd frontend

# Copiar template
cp .env.example .env.development

# En desarrollo, no necesitas editar (valores por defecto funcionan)
# Contenido:
# REACT_APP_API_URL=http://localhost:3001/api
```

---

## 📥 Paso 4: Instalar Dependencias

```bash
# Desde la raíz del proyecto (wesapp/)
npm run install:all

# Esto ejecuta:
# - cd frontend && npm install
# - cd backend && npm install
```

Esto puede tomar 3-5 minutos la primera vez.

---

## 🔄 Paso 5: Ejecutar Migraciones de Base de Datos

Las migraciones se ejecutan **automáticamente** al iniciar el backend:

```bash
# Opción A: Iniciar backend (ejecuta migraciones automáticamente)
npm run dev:backend

# Deberías ver en consola:
# ✅ Database migration: 001 completed
# ✅ Database migration: 002 completed
# ...
# ✅ Server running on port 3001
```

Si prefieres ejecutarlas manualmente:

```bash
# Desde backend/
npm run migrate

# Output:
# ✅ Migration 001 completed
# ✅ Migration 002 completed
# ...
```

---

## 🚀 Paso 6: Iniciar la Aplicación

### Opción A: Modo Desarrollo Completo (Recomendado)

```bash
# Desde wesapp/ (raíz)
npm run dev

# Esto abre ambas en paralelo:
# - Frontend en http://localhost:3000
# - Backend en http://localhost:3001
# - Ambas con auto-reload
```

### Opción B: Separado en Dos Terminales

```bash
# Terminal 1: Backend (con nodemon auto-reload)
npm run dev:backend
# Output: Server running on port 3001

# Terminal 2: Frontend (con React dev server)
npm run dev:frontend
# Output: Compiled successfully!
# Browser abre http://localhost:3000
```

---

## 🧪 Paso 7: Verificar que Todo Funciona

### 1. Backend Health Check

```bash
curl http://localhost:3001/health

# Output esperado:
# {"status":"ok","timestamp":"2024-01-15T10:30:45Z"}
```

### 2. Frontend Accesible

Abre en navegador: http://localhost:3000

Deberías ver la pantalla de login

### 3. Test de Login

```bash
# Usa un usuario de desarrollo creado por tu seed o por el administrador del entorno
# Usuario: usuario_demo
# Password: contraseña_segura

# Intenta login en la web
```

Si el login funciona, ¡todo está listo! ✅

---

## 🛠️ Comandos Útiles

```bash
# Backend - Ejecutar migraciones
npm run migrate

# Validación completa desde la raíz
npm run lint
npm run format:check
npm test
npm run build

# Backend - Watch tests
cd backend && npm run test:watch
```

---

## 🐛 Solucionar Problemas

### ❌ "Port 3001 is already in use"

```bash
# Encontrar y matar proceso en puerto 3001
lsof -ti :3001 | xargs kill -9

# O especificar puerto diferente
PORT=3002 npm run dev:backend
```

### ❌ "Cannot connect to database"

**Verificar conexión PostgreSQL:**
```bash
psql -U postgres -h localhost -d wesapp

# Si falla, comprobar que PostgreSQL está ejecutándose:
# macOS: brew services list
# Windows: Services → PostgreSQL Server
# Linux: sudo systemctl status postgresql
```

**Revisar credenciales en `.env.development`:**
```bash
cat backend/.env.development | grep DB_
```

### ❌ "Migration failed"

```bash
# Ver qué falló
npm run migrate

# Revisar database/migrations/ para ver qué intenta ejecutarse
# Conectar a BD y revisar tabla schema_version:
psql -U postgres -d wesapp
SELECT * FROM schema_version;
\q
```

### ❌ "Cannot GET / 404"

El frontend no se compiló bien:
```bash
# Limpiar y reinstalar
cd frontend
rm -rf node_modules build
npm install
npm start
```

### ❌ "CORS error in console"

Backend no está permitiendo origen del frontend:
- Verifica `CORS_ORIGIN` en `backend/.env.development`
- Debe ser `http://localhost:3000` para desarrollo
- Reinicia backend después de cambiar

---

## ✅ Checklist Final

Verifica que:
- [ ] PostgreSQL está corriendo
- [ ] Base de datos `wesapp` existe
- [ ] `.env.development` en backend y frontend creados
- [ ] `npm run install:all` completó sin errores
- [ ] Migraciones ejecutadas (tabla `schema_version` > 0)
- [ ] Backend responde en `http://localhost:3001/health`
- [ ] Frontend abierto en `http://localhost:3000`
- [ ] Login funciona con un usuario válido del entorno de desarrollo

---

## 📞 Próximos Pasos

Una vez que todo esté funcionando:
1. Revisa [README.md](./README.md) para visión general del proyecto
2. Revisa [API.md](./API.md) para entender los endpoints
3. Empieza a explorar el código en `backend/src/` y `frontend/src/`

¡Listo para desarrollar! 🎉
