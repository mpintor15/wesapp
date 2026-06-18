# 🤝 Contributing Guide - WESApp

Guía para contribuir al desarrollo de WESApp. Asegúrate de seguir estas convenciones para mantener código limpio y mantenible.

---

## 📋 Antes de Empezar

1. Lee [README.md](./README.md) para entender el proyecto
2. Sigue [SETUP.md](./SETUP.md) para configurar tu entorno
3. Familiarízate con [API.md](./API.md) para entender los endpoints

---

## 🔄 Workflow de Desarrollo

### 1. Crear Feature Branch
```bash
git checkout -b feature/nombre-descriptivo
# Ejemplo: feature/add-invoice-filters
```

**Naming conventions:**
- `feature/` - Nueva funcionalidad
- `fix/` - Bug fix
- `refactor/` - Mejora de código sin cambios funcionales
- `docs/` - Cambios en documentación
- `test/` - Agregar tests

### 2. Hacer Cambios
- Siempre edita en una rama separada de `main`
- Commits frecuentes con mensajes claros (ver abajo)
- Pequeños commits = más fácil revisar

### 3. Testear Localmente
```bash
npm run lint
npm run format:check
npm test
npm run build

# Probar manualmente en desarrollo
npm run dev
```

### 4. Push & Pull Request
```bash
git push origin feature/tu-rama
# Luego abre PR en GitHub
```

---

## 💭 Convenciones de Commits

Usa commit messages descriptivos en formato:

```
<tipo>: <descripción corta>

<cuerpo (opcional)>

<referencia a issue (opcional)>
```

**Tipos:**
- `feat:` - Nueva funcionalidad
- `fix:` - Bug fix
- `refactor:` - Cambio de código sin cambios funcionales
- `test:` - Agregar o mejorar tests
- `docs:` - Cambios en documentación
- `style:` - Formatting, espacios, semicolons (sin cambios de código)
- `chore:` - Actualizaciones de dependencias, herramientas

**Ejemplos:**
```bash
git commit -m "feat: agregar filtro de fechas en facturas"
git commit -m "fix: corregir validación de cedula"
git commit -m "refactor: simplificar lógica de cálculo de IVA"
git commit -m "test: agregar tests para controller de usuarios"
git commit -m "docs: actualizar API.md con nuevos endpoints"
git commit -m "chore: actualizar express a 4.19"
```

---

## 🎯 Estructura del Código

### Backend (Node.js/Express)

**File Structure:**
```
backend/src/
├── server.js              # Entry point
├── app.js                 # Express configuration
├── config/
│   ├── database.js        # DB connection setup
│   ├── logger.js          # Application logger
│   ├── migrations.js      # Migration runner
│   └── config.js          # Global config
├── middleware/
│   ├── auth.js            # Token verification
│   ├── httpLogger.js      # HTTP request logging
│   ├── permissions.js     # Role-based access
│   └── validation.js      # Request validation middleware
├── routes/
│   ├── auth.routes.js
│   ├── usuarios.routes.js
│   ├── cuentas.routes.js
│   ├── inventario.routes.js
│   └── personal.routes.js
├── controllers/
│   ├── authController.js
│   ├── usuariosController.js
│   ├── cuentasController.js
│   ├── inventarioController.js
│   └── personalController.js
├── utils/
│   ├── audit.js           # Audit helpers
│   ├── excel.js           # Excel export helpers
│   ├── http.js            # HTTP response helpers
│   └── validationSchemas.js # Zod validation schemas
└── tests/
    └── *.test.js
```

**Naming Conventions:**
- Archivos: `camelCase.js`
- Variables: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`
- Tablas DB: `snake_case`
- Columnas DB: `snake_case`

### Frontend (React)

**File Structure:**
```
frontend/src/
├── index.jsx              # Entry point
├── App.jsx                # Root component
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Cuentas.jsx
│   ├── Inventario.jsx
│   ├── Personal.jsx
│   └── Usuarios.jsx
├── components/
│   ├── ProtectedRoute.jsx
│   ├── Toast.jsx
│   ├── ConfirmDialog.jsx
│   └── ...
├── context/
│   ├── AuthContext.jsx
│   └── ToastContext.jsx
├── services/
│   ├── api.js             # Axios instance
│   └── authService.js
├── styles/
│   └── *.css
└── tests/
    └── *.test.js
```

**Naming Conventions:**
- Componentes: `PascalCase.jsx`
- Servicios: `camelCase.js`
- Constantes: `SCREAMING_SNAKE_CASE`
- Variables: `camelCase`

---

## ⚙️ Code Style Guidelines

### Backend (JavaScript/Node.js)

```javascript
// ✅ DO: Use const/let (never var)
const DB_HOST = 'localhost';
let currentUser = null;

// ✅ DO: Semicolons at end of statements
const result = await db.query('SELECT ...');

// ✅ DO: Meaningful names
const validateUserEmail = (email) => { ... }

// ✅ DO: Error handling
try {
  const user = await getUser(id);
} catch (error) {
  logger.error('Error fetching user:', error);
  res.status(500).json({ success: false });
}

// ❌ DON'T: var
var user = null;

// ❌ DON'T: Single letter names (except in obvious loops)
const u = getUserById(1);

// ❌ DON'T: Nested ternaries
const result = a ? b ? c : d : e;

// ❌ DON'T: Console logs in committed backend code
console.log('User:', user);  // Use config/logger.js instead
```

### Frontend (React/JSX)

```jsx
// ✅ DO: Functional components
const UserCard = ({ name, email }) => {
  return <div className="user-card">{name}</div>;
};

// ✅ DO: Destructure props
const UserProfile = ({ user: { id, name } }) => { ... }

// ✅ DO: Meaningful component names
<UserAuthForm />
<InvoiceList />

// ✅ DO: Props validation (when not using TypeScript)
// Comment prop types at top of component
// const UserCard = ({ name, email }) => {
//   @param {string} name - User full name
//   @param {string} email - User email address

// ❌ DON'T: Inline styles
<div style={{ color: 'red' }}>Error</div>

// ❌ DON'T: Class components (use functional)
class UserCard extends React.Component { ... }

// ❌ DON'T: Prop drilling (too many levels)
<Level1 user={user}>
  <Level2 user={user}>
    <Level3 user={user} />
  </Level2>
</Level1>

// ❌ DON'T: Logic in render
return (
  <div>
    {user.roles.map(role => role.permissions.map(perm => ...))}
  </div>
)
```

---

## 🧪 Testing Guidelines

### Backend Tests

```javascript
// tests/myFeature.test.js
const request = require('supertest');
const app = require('../app');

describe('GET /api/usuarios', () => {
  it('should return all users when authenticated', async () => {
    const response = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.usuarios)).toBe(true);
  });

  it('should return 401 when not authenticated', async () => {
    const response = await request(app).get('/api/usuarios');
    expect(response.status).toBe(401);
  });
});
```

**Test Coverage Targets:**
- Critical business logic: 100% (auth, payments, inventory)
- Controllers: 80%+
- Utilities: 90%+
- Overall: 80%+ by Phase 3

---

## 📝 Documentation

### Commenting Guidelines

**Only comment when needed:**
```javascript
// ✅ DO: Comment complex logic
// Calculate IVA using Colombian tax rates
const ivaValue = amount * (ivaRate / 100);

// ✅ DO: Comment why, not what
// Cache user status for 30s to reduce DB queries
const cachedStatus = cache.get(`user_${id}_status`);

// ❌ DON'T: Obvious comments
const count = items.length; // Get the length of items
const user = getUser(1); // Get user with id 1
```

### JSDoc for Functions

```javascript
/**
 * Calculate total invoice amount including IVA
 * @param {number} subtotal - Subtotal amount
 * @param {boolean} ivaApplicable - Whether IVA applies
 * @returns {Object} { subtotal, iva, total }
 */
const calculateTotal = (subtotal, ivaApplicable) => {
  // ...
};
```

---

## 🐛 Debugging Tips

### Backend
```bash
# Run with debugging output
DEBUG=* npm run dev:backend

# Inspect with Node debugger
node --inspect backend/src/server.js
# Then open chrome://inspect
```

### Frontend
```bash
# React DevTools browser extension (Chrome, Firefox)

# Console logs (temporary only)
console.log('DEBUG:', state);
```

---

## 🔒 Security Checklist

Before pushing code:

- [ ] No hardcoded secrets (API keys, passwords)
- [ ] No SQL injection (always use parameterized queries)
- [ ] No XSS vulnerabilities (never use dangerouslySetInnerHTML)
- [ ] No sensitive data in logs
- [ ] Validate all user input
- [ ] Use HTTPS in production
- [ ] Check dependencies for vulnerabilities: `npm audit`

---

## 📦 Dependency Management

### Adding Dependencies

```bash
# Backend
cd backend
npm install express-validator

# Frontend
cd frontend
npm install react-hook-form

# Add --save-dev for dev dependencies
npm install --save-dev @types/react
```

### Update Dependencies Safely
```bash
# Check for outdated packages
npm outdated

# Update minor/patch versions
npm update

# Update to latest (review breaking changes)
npm install package@latest
```

---

## 📌 Pull Request Checklist

Before submitting PR:

- [ ] Code follows style guidelines
- [ ] Added/updated relevant tests
- [ ] All tests pass: `npm run test`
- [ ] No console.log or debug statements
- [ ] Updated documentation if needed
- [ ] Branch is up-to-date with main: `git pull origin main`
- [ ] Descriptive PR title and description
- [ ] No unrelated changes in PR

---

## ❓ Questions or Issues?

Open an issue on GitHub with:
1. Clear description of problem
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment info (OS, Node version, etc.)

---

## 🙌 Thank You!

¡Gracias por contribuir a WESApp! 🎉
