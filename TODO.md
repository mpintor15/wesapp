# WESApp - Plan maestro de implementacion

## Estado actual

- Rama de integracion: `feat/gestion-ubicaciones`.
- PR visual actual: PR #34 - UI Shell y Dashboard, fusionado hacia `feat/gestion-ubicaciones`.
- Ultimo commit del PR visual: merge commit `a6c75f3bcac6f9d3443a80ee885857b061d2dcb3`.
- Fecha de actualizacion: 2026-08-04.
- Estado general del proyecto: UI Shell y Dashboard implementados, fusionados, validados por CI post-merge y aprobados manualmente. Bloque visual Gerente ronda 1 en separacion productiva para Dashboard y Cuentas/Facturas.
- Rama actual: `fix/ui-gerente-qa-round-1`.
- Siguiente trabajo: comenzar bloque Clientes desde `ui/clientes-directorio-phase-1`.

## Leyenda de estados

- [ ] Pendiente
- [~] En progreso
- [x] Implementado
- [V] Validado manualmente
- [B] Bloqueado
- [A] Requiere autorizacion

## Reglas globales aprobadas

- [x] Columnas de acciones: aplica a todos los modulos actuales y nuevos. No deben mostrar un titulo textual visible como "Acciones", "Opciones" ni equivalente; si la tabla requiere encabezado, debe ser vacio o solo accesible para lectores de pantalla.
- [x] Columnas de acciones: deben conservar accesibilidad mediante `aria-label`, `title` o tooltip; ocupar el menor ancho razonable; ajustarse al contenido; mantener los botones en una sola fila; mostrar unicamente acciones disponibles; no duplicar acciones que ya existen en otra columna.
- [A] Cambiar la convencion global de columnas exclusivas de acciones requiere autorizacion.
- [x] Headers de modulos: todos deben utilizar los mismos tokens de paleta, degradado, contraste, borde, sombra y acento del Dashboard. El contenido y las acciones pueden variar; la identidad visual no.
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
- [x] Paleta del degradado del Dashboard implementada para aumentar contraste del logo.
- [x] Contraste del nombre del usuario mejorado.
- [x] Contraste del rol mejorado.
- [x] Contraste del boton "Cerrar sesion" mejorado.
- [x] Iconografia del Dashboard sustituida.
- [x] Un icono unico por modulo en Dashboard.
- [x] Clientes e Inventario no comparten icono.
- [V] Revision manual detecto jerarquia visual general aceptable.
- [V] Contraste del nombre de usuario, rol y boton "Cerrar sesion" validado manualmente.
- [V] Iconografia, balance visual, jerarquia y consistencia WES validados manualmente.
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

- [~] Estado: en progreso.
- [~] Siguiente rama: `test/automated-visual-qa`.
- [~] Siguiente trabajo: QA visual automatizado.

Alcance inicial:

- [ ] Errores JavaScript.
- [ ] Consola.
- [ ] Red.
- [ ] Overflow.
- [ ] Elementos criticos.
- [ ] Imagenes rotas.
- [ ] Permisos visibles.
- [ ] Screenshots temporales.
- [ ] JSON y Markdown.
- [ ] Seccion obligatoria: "Que debes revisar tu manualmente".

### Dashboard pendiente

- [ ] Menu de usuario.
- [ ] Mi cuenta.
- [ ] Cambiar contrasena.
- [ ] Cerrar sesion dentro del menu.
- [x] Propuesta e integracion de iconos.
- [x] Incorporacion de una sola libreria de iconos: `lucide-react`.
- [ ] Mejora visual conservadora, sin rediseno completo.

### Cuentas / Facturas

- [x] Evitar scroll horizontal.
- [ ] Mejorar selector de filas.
- [x] Centrar badge de estado horizontal y verticalmente.
- [x] Reducir el ancho de la columna Estado.
- [ ] Mejorar modal de reporte.
- [ ] Alinear filtros.
- [ ] Permitir fecha al crear.
- [ ] Bloquear edicion posterior.
- [x] Reorganizar columna de acciones sin botones montados.
- [x] Reacomodar la columna Acciones para que ambos botones queden en una sola fila.
- [V] Ausencia de scroll horizontal validada manualmente.
- [V] Estado centrado validado manualmente.
- [V] Acciones en una sola fila validadas manualmente.
- [x] Ancho minimo razonable de columna de acciones implementado.
- [ ] Validacion final del ancho minimo razonable de columna de acciones.

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
- [ ] Eliminar scroll horizontal de la tabla de Directorio.

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
