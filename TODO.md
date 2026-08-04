# WESApp - Plan maestro de implementacion

## Estado actual

- Rama de integracion: `feat/gestion-ubicaciones`.
- PR visual actual: PR #34 - UI Shell y Dashboard.
- Ultimo commit del PR visual: `12e1f6552cbd39eb01b3a591cd62ad6ec8d8b437`.
- Fecha de actualizacion: 2026-08-04.
- Estado general del proyecto: UI Shell y Dashboard implementados, validados por CI visual estricto y aprobados manualmente. Siguiente foco: QA visual automatizado en `test/automated-visual-qa`.

## Leyenda de estados

- [ ] Pendiente
- [~] En progreso
- [x] Implementado
- [V] Validado manualmente
- [B] Bloqueado
- [A] Requiere autorizacion

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
- [V] Commits verificados: `562614e986a68b9aa3b3ec5b960ecfb36aadb2b1` y `12e1f6552cbd39eb01b3a591cd62ad6ec8d8b437`.
- [V] Validacion visual manual aprobada.
- [V] Seis checks verdes: Backend Quality, Backend Tests, Critical E2E, Frontend Build, Frontend Quality y Visual Responsive.

### QA visual automatizado

- [~] Estado: en progreso.
- [~] Siguiente rama: `test/automated-visual-qa`.

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
- [V] PR #34 UI Shell y Dashboard - OPEN Draft, base `feat/gestion-ubicaciones`, head `feat/next-functional-change`; commits `562614e986a68b9aa3b3ec5b960ecfb36aadb2b1` y `12e1f6552cbd39eb01b3a591cd62ad6ec8d8b437`; revision visual manual aprobada.

