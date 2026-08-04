# WESApp - Plan maestro de implementacion

## Estado actual

- Rama de integracion: `feat/gestion-ubicaciones`.
- PR visual actual: PR #34 - UI Shell y Dashboard, fusionado hacia `feat/gestion-ubicaciones`.
- Ultimo commit del PR visual: merge commit `a6c75f3bcac6f9d3443a80ee885857b061d2dcb3`.
- Fecha de actualizacion: 2026-08-04.
- Estado general del proyecto: UI Shell y Dashboard implementados, fusionados, validados por CI post-merge y aprobados manualmente. Siguiente foco: QA visual automatizado en `test/automated-visual-qa`.

## Leyenda de estados

- [ ] Pendiente
- [~] En progreso
- [x] Implementado
- [V] Validado manualmente
- [B] Bloqueado
- [A] Requiere autorizacion

## Reglas globales aprobadas

- [x] Columnas de acciones: aplica a todos los modulos. No deben mostrar un titulo textual visible como "Acciones"; si la tabla requiere encabezado, debe ser vacio o solo accesible para lectores de pantalla. La columna debe mantener alineacion consistente, no duplicar acciones y no mostrar botones no disponibles cuando la regla del flujo indique ocultarlos.

## Roadmap principal

### Base tecnica completada

- [x] React Router 7.
- [x] Node 20.
- [x] Permisos frontend centralizados.
- [x] Contratos paginados.
- [x] Servicios backend de Inventario.
- [x] Servicios backend de Cuentas.
- [x] Servicios backend de Personal.
- [x] Regresiones de listados.
- [x] Hook paginado compartido.
- [x] Critical E2E.
- [x] Visual Responsive Linux.

### UI Shell y Dashboard

- [x] Degradado compartido.
- [V] Degradado compartido validado manualmente.
- [x] Cabeceras unificadas.
- [V] Cabeceras unificadas validadas manualmente.
- [x] Dashboard mas compacto.
- [V] Dashboard mas compacto validado manualmente.
- [x] Responsive.
- [V] Responsive validado manualmente.
- [x] Snapshots oficiales Linux.
- [V] Snapshots oficiales Linux validados manualmente.
- [x] CI visual estricto.
- [V] CI visual estricto validado manualmente.
- [V] PR #34 - UI Shell y Dashboard.
- [V] PR #34 fusionado hacia `feat/gestion-ubicaciones` el 2026-08-04.
- [V] Merge commit: `a6c75f3bcac6f9d3443a80ee885857b061d2dcb3`.
- [V] Commits verificados: `562614e986a68b9aa3b3ec5b960ecfb36aadb2b1` y `12e1f6552cbd39eb01b3a591cd62ad6ec8d8b437`.
- [V] Validacion visual manual aprobada.
- [V] Validacion post-merge aprobada por CI canonico en Ubuntu/Chromium.
- [V] Seis checks verdes post-merge: Backend Quality, Backend Tests, Critical E2E, Frontend Build, Frontend Quality y Visual Responsive.
- [V] UI Shell validado.

### QA visual automatizado

- [~] Estado: primera fase implementada localmente; pendiente revision y QA manual.
- [~] Siguiente rama: `test/automated-visual-qa`.
- [~] Siguiente trabajo: QA visual automatizado.
- [~] Rama actual: `test/automated-visual-qa`.
- [x] Configuracion Playwright QA independiente en Chromium.
- [x] Runner local sin inicio ni cierre de procesos ajenos.
- [x] Matriz inicial de 11 escenarios.
- [x] Captura de errores JavaScript.
- [x] Captura de `console.error`.
- [x] Registro informativo de `console.warn`.
- [x] Captura de fallos de red.
- [x] Deteccion de imagenes visibles rotas.
- [x] Screenshots temporales por escenario.
- [x] Reporte JSON en `frontend/qa-results/report.json`.
- [x] Resumen Markdown en `frontend/qa-results/summary.md`.
- [x] Seccion obligatoria "Que debes revisar tu manualmente".
- [x] Workflow manual `workflow_dispatch` preparado, no automatico.
- [ ] No validado manualmente.
- [ ] No publicado.
- [ ] Sin PR abierto.

Commits locales de la fase:

- `985f703` - `test(e2e): add automated visual QA runner`.
- `694e5b4` - `test(e2e): add objective visual diagnostics`.
- `c05e3d8` - `test(e2e): add visual QA reports`.
- `3b860f8` - `ci(e2e): add manual visual QA workflow`.

Alcance inicial:

- [x] Errores JavaScript.
- [x] Consola.
- [x] Red.
- [ ] Overflow general.
- [x] Elementos criticos.
- [x] Imagenes rotas.
- [x] Permisos visibles minimos.
- [x] Screenshots temporales.
- [x] JSON y Markdown.
- [x] Seccion obligatoria: "Que debes revisar tu manualmente".

Escenarios iniciales:

- [x] Dashboard `/` gerente 1440x900.
- [x] Dashboard `/` gerente 390x844.
- [x] Dashboard `/` contador 1440x900.
- [x] Cuentas `/cuentas` contador 1440x900.
- [x] Cuentas `/cuentas` contador 390x844.
- [x] Clientes `/configuracion` gerente 1440x900.
- [x] Clientes `/configuracion` gerente 390x844.
- [x] Inventario `/inventario` gerente 1440x900.
- [x] Inventario `/inventario` gerente 390x844.
- [x] Personal `/personal` gerente 1440x900.
- [x] Usuarios `/usuarios` gerente 1440x900.

Validaciones de la fase:

- [x] `npm --prefix frontend run lint`.
- [x] `npm --prefix frontend run test:unit -- --runInBand --testPathPattern=qaVisualReport.test.js`.
- [x] `npm --prefix frontend run test:qa:visual` dos veces consecutivas contra `wesapp_e2e`, backend `3201` y frontend `3200`.
- [x] Resultado estable de la suite QA visual: 11 escenarios, 11 pasados, 0 bloqueantes, 0 altos, 0 medios, 0 bajos.
- [ ] Validaciones generales finales pendientes tras el cuarto commit.

Verificado automaticamente por QA visual:

- [x] Rutas cargadas.
- [x] Login por rol con fixtures `e2e_gerente` y `e2e_contador`.
- [x] Ruta final esperada.
- [x] Root esperado visible.
- [x] Heading principal visible.
- [x] Ausencia de Error Boundary.
- [x] Errores JavaScript.
- [x] `console.error`.
- [x] Requests fallidas.
- [x] Respuestas locales `>=500`.
- [x] `401/403` inesperados.
- [x] Imagenes visibles rotas.
- [x] Permisos visibles minimos en Dashboard.
- [x] Screenshots temporales.

Debe revisar Martin manualmente:

- [ ] Dashboard - calidad estetica del degradado.
- [ ] Dashboard - tamano percibido del logo.
- [ ] Dashboard - densidad de tarjetas.
- [ ] Cabeceras - consistencia visual entre modulos.
- [ ] Cuentas - claridad de acciones.
- [ ] Clientes - ritmo visual y legibilidad.
- [ ] Inventario - densidad de controles.
- [ ] Personal - jerarquia de acciones.
- [ ] Usuarios - claridad de acciones sensibles.

Bloqueos:

- [ ] Ningun bloqueo activo.

Siguiente accion:

- [ ] Ejecutar validaciones generales completas.
- [ ] Revisar diff final.
- [ ] No hacer push ni abrir PR hasta autorizacion.

### Dashboard pendiente

- [ ] Menu de usuario.
- [ ] Mi cuenta.
- [ ] Cambiar contrasena.
- [ ] Cerrar sesion dentro del menu.
- [ ] Propuesta e integracion de iconos.
- [A] Incorporacion de una sola libreria de iconos.
- [ ] Mejora visual conservadora, sin rediseno completo.

### Cuentas / Facturas

- [ ] Evitar scroll horizontal.
- [ ] Mejorar selector de filas.
- [ ] Centrar badge de estado.
- [ ] Mejorar modal de reporte.
- [ ] Alinear filtros.
- [ ] Permitir fecha al crear.
- [ ] Bloquear edicion posterior.

### Cuentas / Pagos

- [ ] Eliminar texto del historial.
- [ ] Mejorar selector.
- [ ] Referencia obligatoria para cheque.
- [ ] Referencia obligatoria para transferencia.
- [ ] Referencia inexistente para efectivo.
- [ ] Incluir referencia en reportes.

### Clientes general

- [ ] Quitar descripcion del header.
- [ ] Contador en todas las tabs.
- [ ] Reportes de Directorio.
- [A] Reportes de Directorio y Ubicaciones.
- [ ] Reportes de Ubicaciones.

### Clientes / Directorio

- [ ] Eliminar titulo repetido.
- [ ] Placeholder correcto.
- [ ] Alinear filtros.
- [ ] Separar telefono y correo.
- [ ] Simplificar identificacion.
- [ ] Centrar encabezados.
- [ ] Eliminar accion redundante de ubicaciones.
- [ ] Eliminar columnas congeladas.
- [ ] Bloquear nombre, razon social, tipo e identificacion en edicion.
- [ ] Retirar eliminacion de clientes.
- [A] Retiro funcional de eliminacion de clientes.
- [ ] Quitar titulo de Acciones.
- [ ] Quitar negritas.
- [ ] Validar cedula de 10 digitos.
- [ ] Validar RUC de 13 digitos.
- [ ] Solo numeros.

### Clientes / Ubicaciones

- [ ] Dejar solo busqueda.
- [ ] Quitar filtro por cliente.
- [ ] Quitar indicadores.
- [ ] Quitar warning.
- [ ] Cliente primero.
- [ ] Ubicaciones expandibles por cliente.
- [A] Agrupacion expandible de ubicaciones.
- [ ] Estado "En uso" mediante badge y tooltip.
- [ ] Quitar textos innecesarios.
- [ ] Quitar titulo de Acciones.
- [ ] Quitar containers y negritas.
- [ ] Selector buscable.
- [ ] Agrupar nuevas ubicaciones en el cliente existente.

### Inventario / Movimientos

- [ ] Eliminar columna Reversion.
- [ ] Mostrar anulacion solo cuando sea posible.
- [ ] No mostrar botones deshabilitados.
- [ ] Eliminar accion visible de regenerar PDF.
- [ ] Descargar existente.
- [ ] Generar si falta.
- [ ] Validar archivo corrupto.
- [ ] Evitar generacion concurrente.
- [A] Flujo de PDF backend requiere autorizacion.

### Inventario / Dados de baja

- [ ] Mejorar tabla.
- [ ] Eliminar columna Reversion.
- [ ] Mostrar anulacion solo cuando sea posible.

### Personal

- [ ] Cedula solo numerica.
- [ ] Exactamente 10 digitos.
- [ ] Bloquear modificacion en backend.

### Usuarios

- [ ] Selector inicia vacio.
- [ ] Placeholder "Selecciona un tipo de usuario".
- [ ] Seleccion obligatoria.
- [ ] Validacion frontend y backend.

### QA por roles

Debe realizarse despues de cerrar los cambios compartidos del Gerente.

- [ ] Secretario.
- [ ] Contador.
- [ ] Supervisor.

## Cambios que requieren autorizacion

- [A] Libreria de iconos.
- [A] Agrupacion de ubicaciones.
- [A] Eliminacion funcional de clientes.
- [A] Nuevos reportes.
- [A] Recuperacion automatica de PDF.
- [A] Migraciones.
- [A] Cambios de permisos.
- [A] Contratos API.
- [A] Cambios de base de datos.

## Que debe revisar Martin

Seccion viva para validaciones manuales requeridas o aprobadas.

### Estado actual

- [V] PR #34 - UI Shell y Dashboard.
- [V] PR #34 fusionado y validado por CI post-merge.

### Pendiente futuro

- [ ] Menu de usuario.
- [ ] Iconos.
- [ ] Cuentas.
- [ ] Clientes.
- [ ] Inventario.
- [ ] Personal.
- [ ] Usuarios.
- [ ] QA Secretario.
- [ ] QA Contador.
- [ ] QA Supervisor.

## Historial de PRs relevantes

- [x] PR #14 React Router 7 - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `3e035d9ec038ff294cd6fe22ff2109c76781ef4a`.
- [x] PR #15 permisos frontend - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `da6729d97e090055aaf66db344c4353f710aafd3`.
- [x] PR #18 paginacion - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `ca8bebd941ca07bffb848242ef48387ea4b613dc`.
- [x] PR #20 Inventario services - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `99799df9eff026e1d7a15e9a40a240d9067eed3a`.
- [x] PR #22 Cuentas services - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `cf1003cd1e338ea0a8ba8bc227bebb53f59e515e`.
- [x] PR #24 Personal services - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `74697799d8578643c500ec4898f7bda2eaef3a2f`.
- [x] PR #26 contratos - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `f31b8d688f5e14d46373fae5df2aac28bafdad21`.
- [x] PR #28 hooks paginados - MERGED el 2026-07-29 hacia `feat/gestion-ubicaciones`; merge commit `995103a28534ab9cb1a7b1df2d912ab4ffae8b0f`.
- [x] PR #30 Critical E2E - MERGED el 2026-07-30 hacia `feat/gestion-ubicaciones`; merge commit `d91b6d2b0717fcb7e7a5298853a4a4924562aa30`.
- [x] PR #32 Visual Responsive - MERGED el 2026-07-30 hacia `feat/gestion-ubicaciones`; merge commit `08cc4f9adaccae9cbe8a76d61202e80c85510347`.
- [V] PR #34 UI Shell y Dashboard - MERGED el 2026-08-04 hacia `feat/gestion-ubicaciones`; head `feat/next-functional-change`; commits `562614e986a68b9aa3b3ec5b960ecfb36aadb2b1`, `12e1f6552cbd39eb01b3a591cd62ad6ec8d8b437` y `250eb001f51ab1b6ceacaaee49ab58c02c23a0e4`; merge commit `a6c75f3bcac6f9d3443a80ee885857b061d2dcb3`; revision visual manual aprobada; CI post-merge verde.

## Validacion post-merge

- [V] Node real: `v20.20.2`.
- [V] `npm --prefix backend run lint`.
- [V] `NODE_ENV=test DB_NAME=wesapp_test npm --prefix backend test -- --runInBand`.
- [V] `npm --prefix frontend run lint`.
- [V] `npm --prefix frontend run test:unit -- --runInBand`.
- [V] `node --test frontend/scripts/check-production-bundle.test.js`.
- [V] `npm --prefix frontend run build`.
- [V] `npm run lint`.
- [V] `npm run format:check`.
- [V] `git diff --check`.
- [V] `npm --prefix frontend run test:e2e:critical` contra `wesapp_e2e`, backend `3201` y frontend `3200`.
- [V] CI post-merge `30928386914` en `feat/gestion-ubicaciones`: Backend Quality, Backend Tests, Critical E2E, Frontend Build, Frontend Quality y Visual Responsive en verde.
- [V] `npm --prefix frontend run test:e2e:visual` validado por CI canonico Ubuntu/Chromium.
- [ ] Diagnostico local macOS: `npm --prefix frontend run test:e2e:visual` ejecuto contra `wesapp_e2e`, backend `3201` y frontend `3200`, pero fallo 9/9 por diferencias de rasterizacion contra baselines Linux. El README de E2E documenta que CI es la validacion visual canonica y que las diferencias de fuentes macOS son esperables.
