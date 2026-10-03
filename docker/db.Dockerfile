# Postgres con el esquema inicial. Se aplica solo la primera vez (volumen vacío).
FROM postgres:16-alpine
COPY --chown=postgres:postgres --chmod=644 database/schema.sql /docker-entrypoint-initdb.d/001_schema.sql
