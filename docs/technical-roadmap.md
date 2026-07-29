# WESApp Technical Roadmap

## Estado de partida

La rama de integración contiene la migración a React Router 7, la alineación a Node.js 20 y la centralización del modelo de autorización frontend. La autorización del frontend usa un catálogo compartido, `can`, `canAny` y `canAll`, y quedó alineada con la matriz efectiva del backend. La validación local sobre Node.js 20 cubrió lint, pruebas backend, pruebas frontend, validador del bundle y build productivo.

El flujo de integración fue estabilizado para que CI también valide `feat/gestion-ubicaciones` y para que los tests backend de GitHub Actions usen una base local `wesapp_test` con PostgreSQL de servicio.

## Arquitectura actual resumida

| Capa | Directorios principales | Responsabilidad | Riesgo observado |
|---|---|---|---|
| Backend HTTP | `backend/src/routes`, `backend/src/app.js` | Rutas Express, middlewares, health checks, CORS, rate limit | CI ya cubre lint/tests, pero E2E no es obligatorio. |
| Backend dominio | `backend/src/controllers`, `backend/src/services`, `backend/src/modules` | Reglas de negocio, transacciones, validaciones y exportaciones | Controladores de Inventario y Cuentas concentran demasiada lógica. |
| Backend persistencia | `backend/src/repositories`, `backend/src/config/database.js` | SQL, pool, transacciones y health checks | Inventario y Cuentas ya tienen listados críticos paginados; Personal queda pendiente para una rama posterior. |
| Base de datos | `database/schema.sql`, `database/migrations` | Esquema local, migraciones, índices y restricciones | Buenas guardas en migraciones recientes; rollback operativo no está estandarizado por cambio. |
| Frontend app | `frontend/src/App.jsx`, `frontend/src/context`, `frontend/src/auth` | Rutas, sesión, permisos y estado global | Autorización centralizada; tokens persisten en `localStorage`. |
| Frontend módulos | `frontend/src/pages`, `frontend/src/components`, `frontend/src/hooks` | Pantallas, formularios, tablas, modales y servicios HTTP | Algunas páginas y CSS son grandes; hay duplicación visual en tablas/filtros/modales. |
| Pruebas | `backend/src/tests`, `frontend/src/**/*.test.*`, `frontend/e2e` | Unitarias, integración backend, visual/responsive E2E | E2E visual/responsive existe pero no está automatizado en CI. |
| Despliegue | `railway.json`, `.github/workflows` | Runtime, checks y release | Pipeline mínimo presente; observabilidad/rollback aún dependen de práctica manual. |

## Riesgos principales

| ID | Categoría | Severidad | Problema | Evidencia | Impacto | Esfuerzo | Riesgo | Dependencias | Acción |
|---|---|---|---|---|---|---|---|---|---|
| CI-001 | CI/CD | P2 | La integración necesitaba checks sobre `feat/gestion-ubicaciones` y PostgreSQL local en backend tests. | `.github/workflows/ci.yml` antes solo observaba `main`; backend tests crean bases temporales. | PRs hacia integración podían quedar sin validación remota. | XS | Bajo | Ninguna | corregido |
| CI-002 | CI/CD | P2 | El hook pre-push ejecutaba el build raíz, que invocaba instalación. | `.husky/pre-push`; script raíz `build`. | Hooks podían modificar dependencias o fallar por entorno inseguro. | XS | Bajo | Ninguna | corregido |
| BE-001 | Arquitectura backend | P2 | `inventarioController.js` concentra reglas, SQL, transacciones, PDF y Excel. | PR #20 extrajo constantes de dominio y repositorio de lectura para artículos, catálogo/exportación de artículos y movimientos. | Menor acoplamiento en lecturas; comandos, bajas, PDF y reportes quedan como riesgo residual. | L | Medio | Cobertura existente de inventario | parcialmente corregido |
| BE-002 | Arquitectura backend | P2 | `cuentasController.js` mezclaba control HTTP, reportes, queries dinámicas y Excel. | PR #22 extrajo lecturas de pagos, reporte, catálogo de facturas y exportación de reporte a `cuentasReadRepository`; comandos transaccionales quedaron fuera de alcance. | Menor acoplamiento en lecturas; riesgo residual en creación/edición/anulación/eliminación transaccional. | M | Medio | Repositorios de cuentas existentes | parcialmente corregido |
| BE-003 | Rendimiento | P2 | Listados/reportes consultaban conjuntos completos sin límite uniforme. | PR #18 agregó contrato compartido, `LIMIT/OFFSET`, totales y metadata para Inventario y Cuentas. Personal queda pendiente. | Riesgo reducido en artículos, movimientos, facturas y pagos; riesgo residual en Personal. | M | Medio | Contrato frontend/backend de paginación | parcialmente corregido |
| BE-004 | Base de datos | P2 | Rollback de migraciones no está documentado por migración. | Migraciones aplican cambios seguros, pero no cada una documenta reversión operativa. | Menor capacidad de recuperación ante despliegue fallido. | M | Medio | Política de releases | documentar |
| FE-001 | Arquitectura frontend | P2 | `Configuracion.jsx` e `Inventario.jsx` siguen siendo páginas orquestadoras grandes. | Archivos cercanos o superiores a 900 líneas. | Cambios visuales o funcionales tienen alto radio de impacto. | L | Medio | Componentes actuales | implementar |
| FE-002 | UX | P2 | Tablas/filtros dependían mayormente de estado cliente y scroll horizontal. | PR #18 movió búsqueda, filtros, ordenamiento y paginación visible de Inventario/Cuentas al backend. | Menor carga cliente en módulos operativos; siguen pendientes mejoras visuales/responsive. | M | Medio | Paginación backend | parcialmente corregido |
| SEC-001 | Seguridad | P2 | JWT en `localStorage` expone sesión ante XSS. | `frontend/src/services/authService.js` guarda `token` en `localStorage`. | Riesgo plausible si una vulnerabilidad XSS aparece. | M | Medio | Decisión de arquitectura de sesión | investigar |
| SEC-002 | Seguridad | P2 | No se observaron headers CSP específicos. | Express usa Helmet por defecto. | Hardening incompleto frente a inyección de scripts. | S | Bajo | Inventario de assets externos | implementar |
| TEST-001 | Pruebas | P2 | E2E visual/responsive existe pero no corre en CI. | Scripts Playwright en frontend; workflow CI no los ejecuta. | Regresiones visuales pueden entrar por PR. | M | Medio | Datos E2E estables | implementar |
| TEST-002 | Pruebas | P3 | Algunos tests generan mucho ruido de logs esperado. | Salida backend muestra logs de errores de casos negativos. | Menor legibilidad al depurar fallos reales. | S | Bajo | Logger de test | implementar |
| UX-001 | Accesibilidad | P2 | Hay labels sin `htmlFor` en modales complejos. | Modales de Cuentas usan varios `<label>` sin asociación explícita. | Lectores de pantalla pueden perder contexto de campos. | M | Bajo | Componentes de formularios | implementar |
| UX-002 | Responsive | P2 | Tablas densas tienen scroll/overrides extensos. | CSS de Cuentas e Inventario contiene muchos ajustes de overflow. | Riesgo de fricción en móviles operativos. | M | Medio | Auditoría visual Playwright | diseñar |
| DOC-001 | Documentación | P3 | README describe roles por módulos y no el catálogo granular actual. | Tabla de roles mantiene resumen antiguo. | Onboarding puede inducir permisos incorrectos. | XS | Bajo | Modelo de permisos actual | documentar |
| DOC-002 | Documentación | P3 | Estrategia de ramas y DoR/DoD no estaban consolidadas. | Documentación dispersa. | Menor consistencia entre PRs. | XS | Bajo | Este roadmap | corregido |
| OBS-001 | Observabilidad | P2 | No hay monitoreo/alertas documentados para health, errores o DB pool. | Health endpoints existen; no se observa pipeline de alertas. | Incidentes dependen de revisión manual. | M | Medio | Proveedor de despliegue | diseñar |
| DEP-001 | Dependencias | P2 | `npm audit` reportó vulnerabilidades en la instalación del hook anterior. | Salida del hook mostró 74 vulnerabilidades. | Riesgo dependiente de explotabilidad real. | M | Medio | Auditoría de dependencias con lockfile | investigar |

## Backlog priorizado

| Bloque | IDs | Objetivo |
|---|---|---|
| A - Antes de nuevas funcionalidades | CI-001, CI-002, BE-003, TEST-001 | Asegurar validación remota, límites de datos y cobertura crítica antes de crecer. |
| B - Fundamentos para crecimiento | BE-001, BE-002, FE-001, OBS-001, SEC-002 | Reducir acoplamiento, hardening y visibilidad operativa. |
| C - Mejora visual y UX | FE-002, UX-001, UX-002 | Mejorar tablas, formularios, accesibilidad y móvil. |
| D - Preparación de funcionalidades | BE-004, DOC-001, DOC-002 | Documentar contratos, migraciones y permisos para nuevas capacidades. |
| E - Opcional o diferible | TEST-002, SEC-001, DEP-001 | Mejoras o investigaciones con dependencia de política o medición. |

## Cronograma por PR

| Orden | Fase | Rama propuesta | Objetivo | Alcance | Dependencias | Entregables | Validaciones | Riesgo | Esfuerzo | Criterio de cierre |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CI integración | `fix/ci-integration-validation` | Validar PRs hacia integración | Workflow CI y hook pre-push | Ninguna | Checks en `feat/gestion-ubicaciones` y backend tests con PostgreSQL | CI verde, backend tests, frontend build | Bajo | XS | PR fusionado y checks remotos verdes |
| 2 | Roadmap | `docs/technical-roadmap` | Consolidar plan ejecutable | Este documento | Integración validada | Roadmap, DoR, DoD, backlog | Format check si aplica, diff limpio | Bajo | XS | Documento fusionado |
| 3 | Contratos de paginación | `refactor/contracts-paginated-lists` | Definir contrato común de listados | Inventario y Cuentas; Personal contemplado para adopción posterior | Roadmap | Contrato común, defaults, límites, metadata, allowlists, catálogos no paginados para formularios | Backend/frontend lint, backend tests, frontend unit, bundle validator, build, CI remoto | Medio | M | Completado en PR #18 |
| 4 | Paginación backend crítica residual | `refactor/backend-paginate-personal-lists` | Evitar cargas completas restantes | Listados de Personal y consumidores que aún requieran contrato remoto | PR 3 | `limit`, `offset`, totales y filtros compatibles con el contrato común | Backend tests y frontend unit si aplica | Medio | S | Personal adopta el contrato sin cambiar reglas |
| 5 | Paginación frontend residual | `refactor/frontend-paginated-personal-tables` | Consumir paginación del backend restante | Tablas de Personal | PR 4 | Hooks y controles de paginación remota | Frontend unit, E2E smoke si aplica | Medio | S | UI mantiene filtros/sort sin cargar todo |
| 6 | Inventario dominio | `refactor/backend-inventario-services` | Extraer primera capa backend de inventario | Lecturas de artículos, catálogo/exportación de artículos y movimientos | Cobertura actual | Constantes de dominio, repositorio de lectura y tests unitarios | Backend/frontend lint, backend tests, frontend unit, bundle validator, build, CI remoto | Medio | M | Completado en PR #20 |
| 7 | Cuentas dominio | `refactor/backend-cuentas-services` | Aislar reportes y exportaciones | Lecturas de pagos, reporte, catálogo de facturas y exportación de reporte | PR 3 | Repositorio de lectura, allowlists compartidas y tests unitarios | Backend/frontend lint, backend tests, frontend unit, bundle validator, build, CI remoto | Medio | M | Completado en PR #22 |
| 8 | Frontend Inventario shell | `refactor/frontend-inventory-shell` | Reducir orquestación de página | `Inventario.jsx`, hooks y tabs | PR 5 | Hooks por flujo y componentes contenedores | Frontend unit + visual smoke | Medio | L | Página más pequeña y comportamiento igual |
| 9 | Frontend Configuración shell | `refactor/frontend-configuracion-shell` | Separar directorio y ubicaciones | `Configuracion.jsx`, `ClientesCatalog` | PR 5 | Hooks y componentes por catálogo | Frontend unit + responsive smoke | Medio | L | Menor acoplamiento entre clientes/ubicaciones |
| 10 | E2E CI smoke | `test/e2e-ci-smoke` | Automatizar flujos mínimos | Playwright smoke/auth | Datos E2E estables | Job CI opcional o required según duración | CI smoke verde | Medio | M | Smoke corre en PR sin flakes |
| 11 | Visual responsive baseline | `test/visual-responsive-baseline` | Medir UI antes de rediseñar | Playwright visual/responsive | PR 10 | Matriz de pantallas y snapshots saneados | Visual tests documentados | Medio | M | Baseline estable y revisable |
| 12 | Accesibilidad formularios | `fix/a11y-form-labels-modals` | Asociar labels y errores | Modales de Cuentas/Inventario/Configuración | PR 11 | `htmlFor`, `aria-describedby`, roles | Frontend unit + axe/manual checklist | Bajo | M | Campos críticos tienen labels reales |
| 13 | Hardening CSP | `fix/security-csp-headers` | Añadir política CSP compatible | Helmet config, build assets | Inventario de assets | CSP inicial en producción | Backend tests, bundle build | Medio | S | App carga con CSP sin errores |
| 14 | Observabilidad mínima | `feat/observability-health-logging` | Documentar y exponer señales operativas | Health, logs, pool, errores | Proveedor elegido | Métricas/guía de alertas | Health tests/manual deploy check | Medio | M | Runbook de incidentes mínimo |
| 15 | Migraciones rollback | `docs/db-migration-runbook` | Estandarizar despliegue/rollback DB | Docs de migraciones | Política release | Runbook y checklist | Revisión documental | Bajo | S | Cada migración nueva exige plan rollback |
| 16 | Documentación permisos | `docs/permissions-model` | Actualizar roles y permisos | README/API/docs permisos | Modelo actual | Tabla granular y ejemplos | Revisión documental | Bajo | XS | Docs reflejan backend/frontend |
| 17 | Dependencias auditadas | `chore/dependencies-audit-plan` | Separar vulnerabilidades reales de ruido | npm audit, locks | Ventana de mantenimiento | Informe y PRs por paquete | CI completo | Medio | M | Plan aprobado antes de actualizar |

## Detalle de ramas propuestas

Cada rama debe basarse en `feat/gestion-ubicaciones`, abrir PR contra esa rama y no tocar `main` directamente. Los commits sugeridos deben ser pequeños: `fix(area): ...`, `test(area): ...`, `refactor(area): ...` o `docs(area): ...`. El rollback preferido es revertir el merge commit del PR salvo migraciones, que deben incluir plan específico.

## Definition of Ready

Una funcionalidad no empieza sin objetivo, actores, reglas, permisos, estados, datos, errores, UX, impacto backend, impacto frontend, impacto en base de datos, pruebas y criterios de aceptación.

## Definition of Done

Un PR no se cierra sin alcance completo, lint, pruebas, build, autorización revisada, errores controlados, loading y empty states, responsive básico, accesibilidad básica, documentación cuando aplique, migraciones seguras, estado Git limpio, revisión del diff y rollback cuando corresponda.

## Política de ramas

El flujo esperado es:

```text
feature/fix/refactor branch
        ↓
feat/gestion-ubicaciones
        ↓
main
```

Crear una rama por alcance revisable. Evitar ramas genéricas o de más de una semana sin cortes internos. Abrir PR siempre. Fusionar solo con checks verdes, sin conflictos y con diff coherente. Para hotfixes, partir de la rama afectada, validar el mínimo seguro y portar después hacia integración si aplica. Las migraciones requieren diagnóstico previo, script idempotente cuando corresponda y runbook de reversión.

## Métricas de calidad

| Métrica | Objetivo inicial |
|---|---|
| Backend tests | 28 suites y 551 tests verdes en entorno `_test`. |
| Frontend unit | 44 suites y 272 tests verdes. |
| Bundle productivo | Sin endpoints locales funcionales ni sourcemaps públicos. |
| CI | Checks en PR hacia `feat/gestion-ubicaciones` y `main`. |
| Tamaño de módulos | Reducir controladores/páginas más grandes por PRs funcionalmente neutros. |
| E2E | Smoke estable antes de exigir visual completo en CI. |

## Siguiente rama recomendada

La siguiente rama pendiente recomendada es `refactor/backend-personal-services`.

Objetivo: extraer de forma funcionalmente neutra la primera capa backend de Personal, manteniendo reglas, permisos, filtros y contrato HTTP.

Archivos probables iniciales: `backend/src/controllers/personalController.js`, tests de Personal y utilidades/repositorios que ya existan para consultas de colaboradores.

## Decisiones de negocio pendientes

| Pregunta | Motivo | Opciones | Impacto | Fase afectada |
|---|---|---|---|---|
| ¿Cómo debe adoptar Personal el contrato paginado? | Personal no se migró en PR #18 por decisión de alcance. | Rama dedicada backend primero, frontend después si aplica. | Completa la reducción de listados sin límite. | PRs 4-5 |
| ¿La sesión debe migrar de `localStorage` a cookie HttpOnly? | Reduce riesgo ante XSS, pero cambia auth/despliegue. | Mantener, migrar completo, estrategia híbrida. | Cambia backend, frontend y CSRF. | SEC-001 |
| ¿Qué proveedor será fuente de observabilidad? | Health checks existen, pero alertas dependen del entorno. | Railway logs, proveedor externo, mínimo manual. | Define métricas y alertas. | PR 14 |
