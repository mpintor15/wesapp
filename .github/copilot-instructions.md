# WESApp Copilot Instructions

## Project Overview
WESApp is a security management system with a **Node.js/Express backend** and **React/Electron frontend**, using PostgreSQL. The app manages user authentication with role-based access (gerente, secretario, supervisor, contador), accounts tracking, inventory, and personnel.

## Architecture Principles

### Backend Structure (`backend/src/`)
- **Controllers** (e.g., `authController.js`): Business logic, database queries via `db` pool
- **Routes** (`routes/`): HTTP endpoints with middleware chains (e.g., `verifyToken`)
- **Middleware** (`middleware/`): Auth validation, permissions checking
- **Config** (`config/`): Environment variables, permissions matrix, database connection
- **Models**: Currently empty; future ORM layer if needed

**Key Pattern**: Controllers return standardized JSON with `{ success: boolean, message, data }`.

### Frontend Structure (`frontend/src/`)
- **Context** (`AuthContext.jsx`): Global authentication state, user data, permissions
- **Services** (`services/`): API calls via axios instance with token interceptors
- **Pages**: Dashboard, Login, ChangePassword components
- **ProtectedRoute**: Guards routes, enforces first login password change

**Key Pattern**: Axios interceptor auto-injects Bearer tokens; 401 errors redirect to login.

### Database (`database/schema.sql`)
- PostgreSQL with 4 modules: Users, Accounts, Inventory, Personnel
- Roles enforce `tipo_usuario` (4 types), views for reporting, triggers for `updated_at`
- No soft deletes; CASCADE deletes for referential integrity

## Critical Workflows

### Starting Development
```bash
# Backend: requires .env with DB credentials, JWT_SECRET
cd backend && npm install && npm run dev    # Port 3000

# Frontend: requires REACT_APP_API_URL environment variable
cd frontend && npm install && npm start     # Port 3000 (dev server)
```

### Database
- Schema lives in `database/schema.sql`; initialize via `psql` or migration tool
- Test data includes 4 users (all users have placeholder bcrypt hashes - regenerate on setup)
- Views: `vista_reporte_cuentas`, `vista_inventario_alertas` for reporting

### Authentication Flow
1. **POST `/api/auth/login`** → Returns JWT token (24h default)
2. **GET `/api/auth/verify`** → Validates token, returns user with permissions
3. **POST `/api/auth/change-password`** → Required on `primer_login=true`
4. Frontend stores token in `localStorage`, auto-attaches to all API requests
5. 401 responses clear token and redirect to `/login`

## Project-Specific Patterns & Conventions

### Error Handling
- Backend: Always return `{ success: false, message: 'Human-readable error' }`
- Frontend: Axios interceptor catches 401s; check `result.success` before accessing `result.data`
- Never throw raw errors; wrap in try-catch and return structured responses

### Validation
- Backend: Validate request body before database queries (see `authController.js` lines 16-20)
- No validation framework yet; do manual checks with early returns

### Permissions
- `config.js` defines `permissions` object mapping `tipo_usuario` to allowed actions
- `ProtectedRoute` accepts `requiredPermission` prop; enforces via `hasPermission()`
- Future: Implement permission checks in backend route middleware

### Database Queries
- Use parameterized queries only: `db.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario])`
- Always await `db.query()` in try-catch blocks
- Pool connection handled in `config/database.js`

### API Response Format
All endpoints return:
```javascript
{
  success: true|false,
  message: "Status message",
  data: { /* endpoint-specific payload */ }
}
```

### Frontend State Management
- **AuthContext**: Single source of truth for `user`, `isAuthenticated`, `loading`
- Call `useAuth()` to access context; no Redux, no other global state yet
- Services (`authService.js`, `cuentasService.js`) are thin wrappers around API calls

## Integration Points & External Dependencies

### Backend Dependencies
- **express**, **helmet**: Web framework & security headers
- **pg**: PostgreSQL client (pool-based)
- **jsonwebtoken**, **bcrypt**: JWT tokens, password hashing
- **express-rate-limit**: DDoS protection (100 requests/15min)
- **pdfkit**, **exceljs**: PDF/Excel exports (not yet integrated)

### Frontend Dependencies
- **react-router-dom**: Page routing; no query params yet, use state/context
- **axios**: HTTP client with interceptors for token attachment
- **electron**: Desktop app (main: `public/electron.js`); dev via `npm run electron-dev`

### Environment Configuration
**Backend `.env`**:
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET (REQUIRED - change from default!)
PORT, NODE_ENV, CORS_ORIGIN
```

**Frontend `.env`**:
```
REACT_APP_API_URL (default: http://localhost:3000/api)
```

## Common Developer Tasks

- **Add API endpoint**: Create controller method → Export → Add route in `routes/*.routes.js` → Use `verifyToken` middleware
- **Add frontend page**: Create `.jsx` in `frontend/src/pages/`, import in `App.jsx`, wrap in `<ProtectedRoute>`
- **Modify database**: Update `schema.sql`, reinitialize PostgreSQL, re-seed test data
- **Change permissions**: Update `config.js` permissions object, implement check in `ProtectedRoute` or backend middleware
- **Password reset**: New users must use `/api/auth/change-password` on first login (handled by frontend logic)

## Code Quality & Security Notes

- Rate limiting active on `/api/*` (100/15min) — adjust in `app.js` if needed
- CORS configured via environment; default allows all origins (`*`) — lock down in production
- Helmet enabled for HTTP security headers
- bcrypt used for password hashing; never store plaintext
- JWT expires after 24h by default; frontend handles redirect on expiration
- No input sanitization framework; SQL injection prevention via parameterized queries only

## Known Limitations & TODO

- Permission enforcement only in frontend; backend routes lack permission middleware
- No validation library (e.g., Joi); all validation is manual
- No logging framework; uses `console.log`
- Placeholder password hashes in test data — regenerate with real bcrypt on setup
- PDF/Excel exports imported but not integrated into endpoints
- No caching layer or database indexes beyond primary keys and manual ones in schema
