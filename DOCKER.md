# WESApp con Docker

Requisito: Docker Desktop abierto.

```bash
docker compose up --build        # primera vez (o después de cambiar código)
docker compose up -d             # las siguientes veces, en segundo plano
```

Abre **http://localhost:3001**.

| Qué | Detalle |
|---|---|
| Servicios | `app` (API + frontend React compilado) y `db` (PostgreSQL 16) |
| Base de datos | Se crea la primera vez desde `database/schema.sql` (incluye los usuarios de desarrollo `gerente1`, `secretario1`…). Las migraciones de `database/migrations` corren solas al arrancar. |
| PDFs | Volumen `pdf-data` (persisten entre reinicios) |
| Postgres desde tu Mac | `localhost:5433`, usuario/clave `postgres`/`postgres` |

Comandos útiles:

```bash
docker compose logs -f app       # ver logs
docker compose down              # apagar (conserva datos)
docker compose down -v           # apagar y BORRAR base y PDFs (empezar de cero)
```

Para cambiar puertos o claves, crea un archivo `.env` junto al `docker-compose.yml`:

```ini
APP_PORT=3001
DB_HOST_PORT=5433
DB_PASSWORD=otra_clave
JWT_SECRET=un_secreto_largo
```

Notas:
- La imagen corre en modo producción (igual que Railway). `DISABLE_HTTPS_REDIRECT=true` solo existe para poder usarla por `http://localhost`; en Railway no se define.
- Para desarrollo con recarga automática sigue usando `npm run dev` (ver SETUP.md).
