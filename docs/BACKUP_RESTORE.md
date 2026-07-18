# Backup, Restore y Storage Persistente de WESApp

Este procedimiento cubre PostgreSQL y los PDFs de inventario generados en
runtime. No contiene credenciales reales y no debe ejecutarse directamente sobre
producción sin ventana aprobada.

## Storage Persistente de PDFs

WESApp guarda en `movimientos.pdf_path` una referencia relativa portable:

```text
movimientos/movimiento-123.pdf
```

La ruta física se resuelve desde:

```bash
PDF_STORAGE_PATH=/ruta/persistente
```

En Railway, el filesystem normal de la instancia puede ser efímero. Por eso,
`PDF_STORAGE_PATH` debe apuntar a un volumen montado que persista entre deploys,
reinicios y reemplazos de instancia. Ejemplo documental:

```bash
PDF_STORAGE_PATH=/data/wesapp/pdfs
```

Este lote no crea ese volumen ni configura Railway desde consola o dashboard. La
ruta debe configurarse manualmente, con permisos de lectura y escritura para el
proceso Node.js.

## Backup Lógico de PostgreSQL

Crear un directorio fuera del repositorio con permisos restrictivos:

```bash
export BACKUP_DIR="$HOME/wesapp-backups/postgres"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

export BACKUP_FILE="$BACKUP_DIR/wesapp-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Ejecutar `pg_dump` con variables de entorno o `DATABASE_URL`, sin escribir
credenciales en archivos versionados:

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$BACKUP_FILE" \
  "$DATABASE_URL"

chmod 600 "$BACKUP_FILE"
test -s "$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" > "$BACKUP_FILE.list"
```

Verificación mínima:

- archivo existente y con tamaño mayor a cero;
- `pg_restore --list` sin error;
- salida fuera del repositorio;
- prueba periódica de restore en base aislada.

## Restore a Base Vacía

```bash
createdb "$RESTORE_DATABASE_URL"

pg_restore \
  --no-owner \
  --no-acl \
  --dbname="$RESTORE_DATABASE_URL" \
  "$BACKUP_FILE"
```

Después del restore, validar conexión, conteos de tablas críticas, login en un
entorno aislado, cuentas, inventario y descarga de PDFs restaurados.

## Restore de Emergencia Controlado

No restaurar directamente sobre producción sin confirmación, ventana de
mantenimiento y backup previo del estado fallido.

Secuencia recomendada:

1. detener escrituras de la aplicación;
2. preservar un backup del estado fallido;
3. restaurar primero en una base aislada;
4. validar datos y flujos críticos;
5. decidir si se cambia la conexión o si se restaura sobre la base productiva;
6. usar `--clean --if-exists` solo con aprobación explícita:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$TARGET_DATABASE_URL" \
  "$BACKUP_FILE"
```

Un restore de datos puede perder transacciones realizadas después del backup.

## Backup de PDFs

Respaldar todo `PDF_STORAGE_PATH`, preservando nombres y permisos:

```bash
export PDF_BACKUP_DIR="$HOME/wesapp-backups/pdfs"
mkdir -p "$PDF_BACKUP_DIR"
chmod 700 "$PDF_BACKUP_DIR"

tar -C "$PDF_STORAGE_PATH" \
  -czf "$PDF_BACKUP_DIR/wesapp-pdfs-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" \
  .
```

Recomendaciones:

- ejecutar cerca del backup de PostgreSQL;
- cifrar antes de mover fuera del servidor;
- guardar copia externa con acceso restringido;
- restaurar en la misma ruta configurada por `PDF_STORAGE_PATH`;
- validar que `movimientos.pdf_path` tenga archivos correspondientes.

## Orden Operativo Previo a Migraciones

Las migraciones se ejecutan automáticamente al iniciar el backend. Antes de cada
release:

1. identificar commit/tag de release;
2. generar backup PostgreSQL;
3. verificar backup con `pg_restore --list`;
4. respaldar `PDF_STORAGE_PATH`;
5. verificar variables, incluyendo `PDF_STORAGE_PATH`;
6. desplegar;
7. permitir migraciones automáticas al iniciar;
8. comprobar `/health/live`;
9. comprobar `/health/ready`;
10. ejecutar smoke tests;
11. validar descarga de un PDF existente;
12. mantener disponible el rollback.

Volver al binario anterior no revierte automáticamente migraciones de datos.

## Plan de Rollback

### Rollback de Aplicación

- redeploy del commit/tag anterior;
- mismas variables;
- mismo volumen de PDFs;
- verificación de compatibilidad del esquema.

### Rollback de Datos

- detener escrituras;
- preservar estado fallido;
- restaurar backup en entorno controlado;
- validar;
- cambiar conexión o restaurar según procedimiento aprobado.

El rollback de datos puede descartar transacciones posteriores al backup.

## Retención Recomendada

Política inicial sugerida, pendiente de aprobación organizacional:

- backups diarios con retención local corta;
- copias semanales y mensuales externas;
- cifrado en reposo;
- acceso restringido;
- pruebas periódicas de restore en base aislada.

## Sourcemaps y Logs de Producción

Los builds productivos del frontend deben ejecutarse con:

```bash
GENERATE_SOURCEMAP=false
```

El guard `frontend/scripts/check-production-bundle.js` debe ejecutarse después
del build y fallar si encuentra archivos `*.map`, comentarios
`sourceMappingURL` o referencias a sourcemaps en `asset-manifest.json`, JS, CSS,
HTML o JSON del build.

El backend escribe logs a stdout/stderr, compatible con Railway. En producción
no se deben registrar de forma permanente:

- stacks completos;
- header `Authorization`;
- cookies;
- JWT;
- contraseñas;
- `DATABASE_URL`;
- parámetros SQL;
- queries SQL completas;
- cuerpos completos de formularios;
- rutas absolutas internas como `/Users/...` o `/home/...`;
- datos personales o de pagos sin sanitización explícita.

Para investigar errores en producción, usar campos estables y no sensibles:

- timestamp;
- nivel;
- método HTTP;
- ruta;
- status;
- user ID, si ya está disponible;
- código técnico permitido;
- categoría o mensaje operativo normalizado.

Los stacks deben mantenerse para desarrollo y pruebas. No activar stacks
completos en producción de forma permanente.
