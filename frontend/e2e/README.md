# WESApp Visual QA

Playwright Test cubre responsive smoke checks y capturas visuales locales para WESApp.

## Requisitos

1. Levantar PostgreSQL con la base local/test.
2. Levantar backend en `http://localhost:3001` con modo E2E local.
3. Levantar frontend en `http://localhost:3000`.
4. Definir credenciales locales, nunca reales de producción:

```sh
cd backend
E2E_MODE=true npm start
```

En otra terminal:

```sh
cd frontend
export E2E_USERNAME="usuario_local"
export E2E_PASSWORD="password_local"
```

Opcionalmente se puede cambiar el frontend o backend objetivo:

```sh
export E2E_BASE_URL="http://localhost:3000"
export E2E_API_URL="http://localhost:3001/api"
export E2E_BACKEND_HEALTH_URL="http://localhost:3001/health"
export E2E_WORKERS=1
```

`E2E_MODE=true` solo eleva los rate limits cuando el backend no está en producción. No versionar credenciales ni tokens locales.

## Comandos

```sh
npm --prefix ../backend run e2e:prepare-db
npm run test:e2e:critical
npm run test:e2e:auth
npm run test:e2e:smoke
npm run test:responsive
npm run test:responsive:chromium
npm run test:responsive:webkit
npm run test:visual
npm run test:visual:chromium
npm run test:visual:webkit
npm run test:visual:update
```

`test:e2e:critical` cubre login válido, login inválido, protección de rutas,
navegación principal por permisos, lectura básica de Inventario y lectura básica
de Cuentas. No reutiliza `e2e/.auth/user.json`: cada test crea su sesión con las
fixtures locales `e2e_gerente` o `e2e_contador`.

La base crítica debe ser local, aislada y reseteable:

```sh
cd backend
DB_NAME=wesapp_e2e npm run e2e:prepare-db
E2E_MODE=true DB_NAME=wesapp_e2e PORT=3201 JWT_SECRET=e2e_test_secret npm start
```

En otra terminal:

```sh
cd frontend
PORT=3200 REACT_APP_API_URL=http://localhost:3201/api BROWSER=none npm start
E2E_BASE_URL=http://localhost:3200 E2E_API_URL=http://localhost:3201/api npm run test:e2e:critical
```

`e2e:prepare-db` rechaza bases que no terminan en `_e2e` y nunca debe apuntar a
`wesapp`, `wesapp_test` ni producción. La contraseña fixture por defecto
`E2E_Local_Password_123!` es local y no representa una credencial real.

`test:e2e:auth` valida frontend, backend y credenciales antes de guardar `e2e/.auth/user.json`.
Las suites protegidas reutilizan ese `storageState`; no hacen login por test.
`test:e2e:smoke` valida dashboard móvil autenticado en Chromium antes de ejecutar matrices largas.
`test:visual` genera screenshots como artefactos de Playwright en `test-results`.
`test:visual:chromium` y `test:visual:webkit` ejecutan un navegador por vez con `--workers=1`.
`test:visual:update` activa snapshots con `E2E_ASSERT_SNAPSHOTS=1` y debe usarse solo cuando el cambio visual sea intencional.

## Autenticación y 429

Regenerar la sesión antes de suites largas:

```sh
npm run test:e2e:auth
```

Si aparece `HTTP 429 Too Many Requests`, revisar:

- Que el backend se haya iniciado con `E2E_MODE=true`.
- El header `Retry-After` mostrado por Playwright.
- Que no haya otra suite corriendo contra el mismo backend/IP.
- Que las credenciales sean de un usuario local con contraseña ya configurada, sin `primer_login`.

No resolver un 429 aumentando timeouts: esperar `Retry-After` o reiniciar backend en modo E2E local.

## Cobertura Inicial

Responsive smoke:

- `/`
- `/cuentas`
- `/inventario`
- `/personal`
- `/usuarios`

Matriz responsive:

- Chromium: 14 viewports x 5 rutas = 70 tests.
- WebKit: 5 viewports críticos x 5 rutas = 25 tests.
- Total responsive: 95 tests, más el setup de autenticación.

Páginas visuales:

- Login
- Dashboard
- Cuentas: Facturas, Pagos, Clientes
- Inventario: Artículos, Movimientos, Dados de baja
- Personal
- Usuarios

Modales visuales:

- Personal: crear colaborador, reporte
- Usuarios: crear, editar, reenviar invitación
- Inventario: nuevo artículo, movimiento, reportes, dar de baja
- Cuentas: crear/editar/anular factura, pago en lote, reportes

Los modales que dependen de datos existentes hacen `skip` con mensaje claro si no encuentran un trigger o fixture confiable.
