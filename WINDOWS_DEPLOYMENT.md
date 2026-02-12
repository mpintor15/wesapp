# WESApp Windows Deployment (Without GitHub)

This guide is for delivering and installing WESApp on Windows using direct files (ZIP/USB/Drive), without GitHub.

## 1. What you deliver

From this repository, deliver:

- `frontend/dist/WESApp Setup 1.0.0.exe`
- `backend/` (project folder, without `node_modules`)
- `database/schema.sql`
- `database/migrations/` (all migration files)
- `.env.production.example` files as templates

Recommended: put everything into one folder, then compress to `WESApp-Windows-Deploy.zip`.

## 2. Requirements on the Windows machine

- Windows 10/11
- Node.js 20 LTS
- PostgreSQL 14+ (or compatible)
- PowerShell (included by default)

## 3. Database setup (Windows)

1. Create database `wesapp`.
2. Run `database/schema.sql`.
3. Run migrations from `database/migrations/` in order.

If `psql` is available in PATH, example:

```powershell
psql -U postgres -c "CREATE DATABASE wesapp;"
psql -U postgres -d wesapp -f .\database\schema.sql
psql -U postgres -d wesapp -f .\database\migrations\002_performance_and_audit.sql
```

## 4. Backend setup (Windows)

In PowerShell:

```powershell
cd .\backend
npm ci
Copy-Item .env.production.example .env
```

Edit `backend/.env` with real values:

- `PORT=3000`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=wesapp`
- `DB_USER=postgres`
- `DB_PASSWORD=...`
- `JWT_SECRET=...` (required)
- `CORS_ORIGIN=*` only for local desktop use

Start backend:

```powershell
npm start
```

Keep this terminal open, or install PM2 on Windows and run as a managed process.

## 5. Frontend (Electron) install

1. Run installer: `WESApp Setup 1.0.0.exe`
2. Open WESApp.
3. Ensure API points to local backend URL (`http://localhost:3000/api`).

If needed, rebuild frontend with a local API URL before packaging:

```powershell
cd .\frontend
"REACT_APP_API_URL=http://localhost:3000/api" | Out-File -Encoding ascii .env.production
npm ci
npm run build
npm run electron-pack:win
```

## 6. Quick validation checklist

- Backend responds: `http://localhost:3000/api/health` (or any existing endpoint)
- Login works
- Create/edit records works
- Reports/export works
- App restarts without losing DB connection

## 7. Common issues

- `EADDRINUSE 3000`: another process uses port 3000, change backend `PORT` and rebuild frontend API URL.
- DB auth errors: verify `DB_USER/DB_PASSWORD` and PostgreSQL service status.
- CORS errors: verify `CORS_ORIGIN` in backend `.env`.
- White screen in app: run backend first, then relaunch desktop app.
