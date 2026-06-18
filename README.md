# WESApp - Sistema de Gestión para WES Security

**Versión:** 1.0.0  
**Autor:** WES Security

## 📋 Descripción

WESApp es una plataforma integral de gestión diseñada específicamente para WES Security. Permite administrar:

- **Cuentas & Facturación** - Gestión de clientes, facturas, pagos y cuentas por cobrar
- **Inventario** - Control de equipos, ubicaciones, movimientos y bajas de artículos
- **Personal** - Registro y gestión de empleados
- **Usuarios** - Administración de acceso con control de roles

## 🛠 Stack Tecnológico

### Backend
- **Runtime:** Node.js ≥ 18.0.0
- **Framework:** Express 4.18
- **Database:** PostgreSQL 12+
- **Authentication:** JWT + Bcrypt
- **Security:** Helmet, CORS, Rate Limiting

### Frontend
- **Framework:** React 18.2
- **Router:** React Router v6
- **HTTP Client:** Axios
- **Styling:** CSS personalizado

### Deployment
- **Deployment:** Railway
- **Build:** Frontend React + Backend Node/Express

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- PostgreSQL 12+ (local o remoto)

### Instalación Completa
```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd wesapp

# 2. Instalar dependencias
npm run install:all

# 3. Configurar variables de entorno
cp backend/.env.example backend/.env.development
cp frontend/.env.example frontend/.env.development

# 4. Crear base de datos
createdb wesapp
# O con PostgreSQL GUI (pgAdmin, DBeaver)

# 5. Ejecutar migraciones
npm run dev:backend
# El servidor ejecutará automáticamente las migraciones al iniciar

# 6. Iniciar en desarrollo
npm run dev
```

Esto abre **frontend** en `http://localhost:3000` y **backend** en `http://localhost:3001`

### Desarrollo Separado
```bash
# Terminal 1 - Backend (con auto-reload)
npm run dev:backend

# Terminal 2 - Frontend (con Hot Module Replacement)
npm run dev:frontend
```

---

## 📁 Estructura del Proyecto

```
wesapp/
├── backend/
│   ├── src/
│   │   ├── server.js           # Entry point
│   │   ├── app.js              # Express app & middleware
│   │   ├── config/             # Database, logger, migrations, global config
│   │   ├── controllers/        # Business logic
│   │   ├── middleware/         # Auth, permissions, validation, HTTP logging
│   │   ├── routes/             # API endpoints
│   │   └── utils/              # Audit, exports, HTTP helpers, validation schemas
│   ├── tests/                  # Jest tests
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── index.jsx           # Entry point
│   │   ├── App.jsx             # Router & providers
│   │   ├── pages/              # Page components
│   │   ├── components/         # Reusable components
│   │   ├── context/            # React context (auth, toast)
│   │   ├── services/           # API service layer
│   │   └── styles/             # CSS stylesheets
│   ├── public/
│   ├── package.json
│   └── .env.example
│
├── database/
│   ├── schema.sql              # Initial schema
│   ├── migrations/             # Version-controlled migrations
│   ├── scripts/                # Utility scripts (audit, seed)
│
├── scripts/                    # Root-level scripts
├── railway.json                # Railway deployment config
└── package.json                # Root workspace config
```

---

## 🔐 Autenticación & Roles

El sistema usa **JWT (JSON Web Tokens)** con roles basados en acceso:

| Rol | Módulos Accesibles |
|-----|-------------------|
| **gerente** | Todos (Cuentas, Inventario, Personal, Usuarios) |
| **secretario** | Cuentas, Inventario, Personal |
| **supervisor** | Inventario (lectura en movimientos), Personal |
| **contador** | Solo Cuentas |

**Primero login:**
- Usuario recibe flag `primer_login = true`
- Sistema obliga a cambiar contraseña en siguiente login
- Token JWT válido por 24 horas

---

## 📚 Documentación Adicional

- [**SETUP.md**](./SETUP.md) - Guía detallada de configuración del entorno
- [**API.md**](./API.md) - Referencia completa de endpoints REST
- [**CONTRIBUTING.md**](./CONTRIBUTING.md) - Guías para desarrollo

---

## 🧪 Testing

```bash
npm run lint
npm run format:check
npm test
npm run build
```

---

## 🚢 Deployment

### A Railway.app
```bash
# 1. Configura el proyecto en Railway y conecta este repositorio

# 2. Railway usa railway.json para el build y start
# - Instala dependencias
# - Construye frontend React
# - Ejecuta backend/src/server.js

# 3. Verifica en https://railway.app
```

### Variables de Entorno Production
Configurar en Railway dashboard:
```
DB_HOST=<cloud-db-host>
DB_PORT=5432
DB_NAME=wesapp
DB_USER=<db-user>
DB_PASSWORD=<secure-password>
DB_SSL=true
JWT_SECRET=<generate-random-256-bit-key>
JWT_EXPIRATION=24h
CORS_ORIGIN=https://your-domain.com
NODE_ENV=production
```

---

## 📊 Base de Datos

**PostgreSQL schema incluye:**
- `usuarios` - User accounts with roles
- `clientes` - Customer records
- `cuentas` - Invoices
- `pagos` - Payments & receipts
- `abonos` - Payment applications
- `articulos` - Equipment inventory
- `movimientos` - Equipment transfers
- `articulos_bajas` - Write-offs
- `colaboradores` - Employee records
- `ubicaciones` - Storage locations
- `audit_log` - Change tracking for compliance

**Migraciones:** Versionadas en `database/migrations/`. Ejecutadas automáticamente al iniciar backend.

---

## 🐛 Troubleshooting

### Port 3001 already in use
```bash
# Kill process on port 3001
lsof -ti :3001 | xargs kill -9
```

### Database connection refused
```bash
# Check PostgreSQL is running
psql -U postgres -h localhost
# Should show: psql (12.x)
```

### Frontend can't reach backend
- Verificar que backend esté ejecutándose en puerto 3001
- Revisar `REACT_APP_API_URL` en `.env.development`
- Verificar `CORS_ORIGIN` en backend `.env.development`

### Migrations failing
```bash
# Ejecutar manualmente
npm run migrate

# Revisa database/migrations/ para error messages
```

---

## 📝 Convenciones de Código

- **Backend:** Node.js, CommonJS modules
- **Frontend:** React, ES6+ modules, JSX
- **Naming:** camelCase para variables, SCREAMING_SNAKE_CASE para constantes
- **Database:** snake_case para tablas y columnas

---

## 📄 Licencia

Propietario - WES Security © 2024

---

## 💬 Soporte

Para reportar bugs o sugerir features, abre un issue en GitHub.
