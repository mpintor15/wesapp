# QA-SEC-002 - Auditoria de anulacion de facturas y pagos

Fecha: 2026-07-21

Restricciones aplicadas:

- No se implementa modelo de reverso de pagos.
- No se modifica base de datos.
- No se crean ni editan migraciones.
- No se reactiva ninguna eliminacion fisica de facturas, pagos o abonos.

## Semantica esperada

- Una factura con `cuentas.cancelada = true` permanece visible en historicos.
- Una factura anulada no suma deuda pendiente.
- Una factura anulada no aparece como vencida ni cobrable.
- Una factura anulada no admite nuevos abonos.
- Los abonos historicos asociados a una factura anulada se conservan.
- Los totales historicos de pagos se mantienen como pagos registrados; los totales de cartera activa excluyen deuda anulada.

## Consultas, calculos y reportes auditados

| Area | Ubicacion | Tratamiento de `cuentas.cancelada = true` |
| --- | --- | --- |
| Vista historica base | `database/schema.sql` - `vista_reporte_cuentas` | La vista conserva la fila y expone `cancelada`, `detalle_anulacion` y `fecha_anulacion`. La vista mantiene valores historicos brutos; los endpoints de reporte normalizan cartera activa sin cambiar la DB. |
| Reporte de cuentas | `backend/src/controllers/cuentasController.js` - `getReporte` | Incluye facturas anuladas en el historico por defecto. Para `cancelada=true`, `por_cobrar` y `saldo_pendiente` salen en `0`; `total_abonos` se conserva. |
| Reporte solo deudores | `backend/src/controllers/cuentasController.js` - `getReporte?solo_deudores=true` | Agrega `COALESCE(v.cancelada, FALSE) = FALSE` y `v.saldo_pendiente > 0`, por lo que las anuladas no aparecen como facturas pendientes, cuentas vencidas ni cobrables. |
| Exportacion de cuentas | `backend/src/controllers/cuentasController.js` - `exportReporteExcel` | Usa la misma seleccion normalizada que `getReporte`: historico visible, deuda anulada en `0`, abonos historicos preservados. |
| Reportes por cliente | `backend/src/controllers/cuentasController.js` - `agrupar_cliente=true` | Solo cambia el ordenamiento/agrupacion. Mantiene las mismas reglas de deuda activa y anulada que `getReporte`. |
| Registro de abonos | `backend/src/controllers/cuentasController.js` - `createBatchAbono` | Bloquea nuevos abonos cuando la factura esta anulada con `FACTURA_CANCELADA`; tambien valida cliente y saldo bajo bloqueo transaccional. |
| Consulta de facturas para abono | `backend/src/repositories/cuentasFacturasRepository.js` - `findFacturasForPaymentValidation` | Lee `c.cancelada` junto con `saldo_pendiente`; el controlador rechaza las canceladas antes de crear pago/abonos. |
| Detalle historico de pagos | `backend/src/controllers/cuentasController.js` - `getPagos` | Conserva pagos y abonos, expone `cancelada` por factura y devuelve `saldo_pendiente = 0` para facturas anuladas. |
| Exportacion de pagos | `backend/src/repositories/cuentasPagosRepository.js` + `exportPagosExcel` | Exporta pagos historicos y sus facturas aplicadas. No calcula deuda cobrable; por eso no excluye anuladas ni borra sus abonos. |
| Consulta de abonos por factura | `backend/src/controllers/cuentasController.js` - `getAbonosByFactura` | Conserva el historico de abonos. No calcula cartera activa ni permite eliminacion desde la regla de negocio actual. |
| Tabla de facturas | `frontend/src/pages/Cuentas/components/FacturasTable.jsx` | Muestra `Activa` o `Anulada` con texto visible. Las anuladas solo exponen detalle de anulacion; no muestran editar ni anular. |
| Filtros de facturas | `frontend/src/pages/Cuentas/utils/cuentasFilters.js` | `conSaldo` excluye anuladas. Los filtros `activa` y `anulada` separan historico de operacion activa. |
| Totales visibles de facturas | `frontend/src/pages/Cuentas/utils/cuentasFilters.js` - `calculateFacturaTotals` | Calcula totales solo con filas no anuladas. Las anuladas permanecen en la tabla cuando corresponda, pero no suman subtotal, por cobrar, abonos ni saldo del total activo. |
| Abono por lote en UI | `frontend/src/pages/Cuentas/utils/cuentasBatchPayment.js` | Selecciona facturas pendientes por cliente con `!row.cancelada` y `saldo_pendiente > 0`; una anulada no puede ser elegida para pago. |
| Detalle visual de pagos | `frontend/src/pages/Cuentas/components/PagoDetailModal.jsx` | El pago sigue visible como historico. Cada factura del pago muestra estado textual `Activa` o `Anulada`; si es anulada, el saldo recibido desde API es `0`. |
| Dashboard | `frontend/src/pages/Dashboard/Dashboard.jsx` | No realiza calculos financieros; solo lista modulos navegables. No hay saldo pendiente, vencido ni cobrable que ajustar. |

## Acciones imposibles de pagos

La UI no muestra `Anular pago` ni `Eliminar pago`, no abre modal destructivo de pagos y no invoca endpoints de anulacion/eliminacion de pagos. En su lugar, la vista de pagos muestra una nota no accionable:

`Los pagos registrados se conservan como parte del historial contable.`

La API mantiene protegidos `DELETE /api/cuentas/pagos/:id`, `PATCH /api/cuentas/pagos/:id/anular` y `DELETE /api/cuentas/abonos/:id` con rechazo 409 para impedir bypass.

## Flujo de anulacion de factura

- La UI muestra `Anular factura`.
- La accion usa exclusivamente `PATCH /api/cuentas/facturas/:num_factura/cancelar`.
- El modal identifica la factura, explica que queda conservada en historico y que no admitira nuevos abonos.
- Mientras se procesa, confirmacion, cancelacion, cierre por backdrop/escape y campo de detalle quedan bloqueados.
- El backend cambia `cancelada = TRUE`, conserva factura y abonos, audita como `UPDATE` y rechaza anulaciones repetidas.

## Suite de migraciones

No se modifican migraciones en este ajuste.

La cobertura estatica de salvaguardas de migraciones ya fue actualizada en
`backend/src/tests/migrations.test.js` para validar semantica y tolerar whitespace en los scripts
SQL. Esa cobertura comprueba, entre otros puntos:

- registro de version de migracion con matcher tolerante a formato;
- eliminacion de unicidad global antigua en ubicaciones;
- relacion nullable entre ubicaciones y clientes para preservar historico;
- unicidad normalizada por cliente;
- normalizacion del catalogo de clientes sin borrar datos historicos;
- falla transaccional cuando existen identificaciones normalizadas duplicadas.

Validacion ejecutada y respaldada por la secuencia de commits:

- `cd backend && npm test -- --silent --runTestsByPath src/tests/clientesRoutes.test.js src/tests/ubicacionesRoutes.test.js src/tests/permissions.test.js src/tests/routeProtection.test.js src/tests/authRoutes.test.js`
- Resultado: 5 suites aprobadas, 168 tests aprobados.

La suite completa de migraciones contra una base PostgreSQL descartable sigue pendiente porque crea y
elimina bases de datos durante la prueba. Esa validacion es distinta de la cobertura estatica ya
corregida y debe ejecutarse posteriormente en un entorno explicitamente descartable con:

`cd backend && npm test`

No hay un fallo conocido vigente en los asserts estaticos incorporados para migraciones.
