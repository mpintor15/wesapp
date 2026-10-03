# WESApp — imagen única: el backend Express sirve la API y el build de React.

# ---------- 1. Build del frontend ----------
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY frontend/ ./
ENV GENERATE_SOURCEMAP=false \
    REACT_APP_API_URL=/api
RUN npm run build

# ---------- 2. Dependencias del backend (solo producción) ----------
FROM node:20-bookworm-slim AS backend-deps
WORKDIR /app/backend
# bcrypt trae binarios precompilados; estas herramientas cubren el caso de compilar desde fuente
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 3. Imagen final ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    PDF_STORAGE_PATH=/data/pdfs
WORKDIR /app

COPY --from=backend-deps --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend/package.json ./backend/package.json
COPY --chown=node:node backend/src ./backend/src
COPY --chown=node:node database/migrations ./database/migrations
COPY --from=frontend-build --chown=node:node /app/frontend/build ./frontend/build

RUN mkdir -p /data/pdfs /app/backend/logs && chown -R node:node /data /app/backend/logs
VOLUME ["/data/pdfs"]

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "backend/src/server.js"]
