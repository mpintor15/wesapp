# Línea base de rendimiento

Fecha: 8 de septiembre de 2026.

Entorno local con PostgreSQL y API en la misma máquina, base E2E pequeña, 5 calentamientos y 30 muestras por operación. Estos resultados sirven para comparar cambios; no representan carga de producción.

| Operación | Tipo | Filas | p50 ms | p95 ms | Objetivo p95 |
|---|---:|---:|---:|---:|---:|
| Personal | API | 4 | 2.26 | 2.72 | 500 |
| Inventario | API | 1 | 2.48 | 2.70 | 500 |
| Cuentas | API | 1 | 2.97 | 3.18 | 500 |
| Bitácora | API | 0 | 5.43 | 5.87 | 500 |
| Visitas | API | 0 | 11.80 | 14.93 | 500 |
| Personal SQL | SQL | 12 | 0.13 | 0.31 | 300 |
| Inventario SQL | SQL | 3 | 0.11 | 0.13 | 300 |
| Cuentas SQL | SQL | 13 | 0.12 | 0.15 | 300 |
| Bitácora SQL | SQL | 0 | 0.09 | 0.11 | 300 |
| Visitas SQL | SQL | 0 | 0.09 | 0.10 | 300 |

Las cinco operaciones más lentas son Visitas, Bitácora, Cuentas, Inventario y Personal. Las cinco son endpoints API; Visitas será el primer foco de las fases 5–7.

En API, “Filas” son las filas retornadas. En SQL, el script suma las filas procesadas reportadas por `EXPLAIN ANALYZE`.

## Reproducción

1. Preparar una base E2E segura: `E2E_DB_NAME=wesapp_perf_e2e npm --prefix backend run e2e:prepare-db`.
2. Ejecutar la API contra esa base.
3. Ejecutar `DB_NAME=wesapp_perf_e2e PERF_BASE_URL=http://localhost:3201 npm run performance:baseline`.

Se pueden ajustar `PERF_ITERATIONS`, `PERF_WARMUPS`, `PERF_USERNAME`, `PERF_PASSWORD` o proporcionar `PERF_TOKEN`.
