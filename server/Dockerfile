# KAVANA Route AI — backend Node/Express en Fly.io (patrón Steelworks 2026-08)
# Node 20 + Express + pg + tesseract.js + pdfkit. pdftotext se instala en la
# imagen porque el OCR de PDFs depende del binario de poppler-utils.
FROM node:20-slim

ENV NODE_ENV=production \
    PORT=5001 \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

# pdftotext (OCR de PDFs). En Render free no se podía instalar en build por el
# FS read-only; en Docker sí.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Dependencias primero (cache de capas): package.json + lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Código de la app (src/ contiene index.js, rutas, servicios y seed.js)
COPY src ./src
# Migraciones SQL versionadas (aplicadas en arranque sobre PostgreSQL)
COPY migrations ./migrations
# Documentación del repo: el asistente técnico la indexa como corpus (RAG).
# Sin estos archivos el asistente en producción responde "no documentado" o error.
COPY README.md DECISIONS.md SECURITY.md ./
COPY docs ./docs

# Directorios de artefactos (PODs y fotos de incidencias). En Fly viven en un
# volumen persistente montado en /app/data (DATA_DIR, ver fly.toml [mounts]).
RUN mkdir -p /app/data/pods /app/data/incidents

EXPOSE 5001

CMD ["node", "src/index.js"]
