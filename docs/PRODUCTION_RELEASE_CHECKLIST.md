# Checklist mínimo de liberación a producción

Esta lista es obligatoria para cada release. El responsable de la liberación
debe guardar la evidencia (enlace al run, ticket o registro de cambios).

## Antes del despliegue

- [ ] El commit de release está etiquetado y el árbol de trabajo está limpio.
- [ ] CI está verde: calidad, pruebas, build, E2E crítica, regresión visual y
      auditoría de dependencias.
- [ ] La migración incluida fue revisada; se identificó su impacto de bloqueo,
      se generó un backup y existe un procedimiento de reversión operativo.
- [ ] Se generó y verificó un backup de PostgreSQL con `pg_restore --list`.
- [ ] Se respaldó el volumen `PDF_STORAGE_PATH`.
- [ ] Se confirmó que `PDF_STORAGE_PATH` apunta a un volumen persistente y que
      las credenciales, CORS, SSL de DB y `JWT_SECRET` son los de producción.

## Durante el despliegue

- [ ] Se registra la hora, el responsable, tag/commit y ventana de cambio.
- [ ] Se supervisan los logs de arranque; una migración fallida detiene la
      liberación y no se hacen reintentos a ciegas.
- [ ] Se conserva el release anterior como candidato de rollback.

## Después del despliegue

- [ ] Se ejecuta `PRODUCTION_URL=https://dominio ./scripts/smoke-production.sh`.
- [ ] Se valida manualmente, con una cuenta no privilegiada cuando aplique:
      login, permisos, creación/anulación de factura, pago, movimiento de
      inventario y registro/cierre de visita.
- [ ] Se descarga un PDF histórico y se verifica que abre correctamente.
- [ ] Se verifica que el monitor externo recibe `200` de `/health/ready` y que
      las alertas de caída/error están activas.

## Configuración externa obligatoria

Esto no se puede garantizar desde el repositorio y debe configurarse en el
proveedor de infraestructura:

- Monitor HTTP externo para `/health/ready`, con alerta a un canal atendido.
- Alerta por errores de aplicación y por indisponibilidad de PostgreSQL.
- Backup automático cifrado de PostgreSQL y del volumen de PDFs, con retención
  definida y una restauración de prueba al menos trimestral.
- Acceso restringido a logs, backups y variables de producción.

Si falla un punto P0, se detiene la liberación o se activa el rollback descrito
en `docs/BACKUP_RESTORE.md`.
