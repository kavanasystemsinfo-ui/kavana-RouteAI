# Despliegue — KAVANA Route AI (actualizado 2026-08-17)

## Arquitectura de despliegue

| Componente | Donde vive | URL |
|------------|-----------|-----|
| Backend API (Node/Express) | Fly.io (máquina 256MB + volumen `routeai_data`) | https://kavana-routeai-api.fly.dev |
| Base de datos PostgreSQL | Neon (serverless) | — |
| Panel oficinas "Torre de Control" | GitHub Pages | https://www.routeai.kavanasystems.com |
| App del repartidor (React web) | GitHub Pages (/app) | https://www.routeai.kavanasystems.com/app |

> **Histórico:** hasta agosto 2026 el backend vivía en Render free
> (`kavana-routeai-api.onrender.com`). Se migró a Fly.io cuando Render suspendió
> el servicio por límite de horas del free tier. `render.yaml` queda en el repo
> como configuración histórica, ya no se usa.

---

## 1. Base de datos — Neon (PostgreSQL)

**No usamos JSON store en producción.** PostgreSQL via Neon, persistente y gratis.

### Crear base de datos
1. https://neon.tech → Sign in with GitHub → Create project (region EU West)
2. Copiar connection string o usar variables individuales

### Variables de entorno en Fly.io (secrets)
```bash
flyctl secrets set --app kavana-routeai-api \
  PGHOST=ep-xxxx.eu-central-1.aws.neon.tech \
  PGUSER=neondb_owner \
  PGPASSWORD=npg_xxx \
  PGDATABASE=neondb \
  PGPORT=5432 \
  PGSSLMODE=require
```

**⚠️ PITFALL — Prioridad de variables:** El código revisa primero `PGHOST`; si existe, usa Neon. Si no, usa `DATABASE_URL`. Si ninguna, fallback a JSON store (solo dev).

**⚠️ PITFALL — Supabase solo da IPv6:** Supabase free tier solo responde por IPv6. Fly free solo tiene salida IPv4. **No usar Supabase con Fly.** Usar Neon.

---

## 2. Backend — Fly.io

### Configuración (server/Dockerfile + server/fly.toml)
- `server/Dockerfile` — Node 20 slim + poppler-utils (OCR de PDFs). `npm ci --omit=dev`, arranca con `node src/index.js`.
- `server/fly.toml` — app `kavana-routeai-api`, región `cdg`, máquina 256MB shared, `auto_stop_machines="stop"` + `auto_start_machines=true` (la máquina se duerme sin tráfico y despierta al primer request; NO se suspende como Render).
- Volumen `routeai_data` montado en `/app/data` (PODs y fotos de incidencias persistentes).

### Desplegar
```bash
# Requisitos: flyctl instalado y autenticado (flyctl auth login)
cd server

# Crear app (solo la primera vez)
flyctl apps create kavana-routeai-api --org personal

# Crear volumen (solo la primera vez)
flyctl volumes create routeai_data --app kavana-routeai-api --region cdg --size 1 --yes

# Secrets (solo la primera vez o al rotar)
flyctl secrets set --app kavana-routeai-api JWT_SECRET=<random> OFFICE_PIN=<pin> \
  PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=neondb PGPORT=5432 PGSSLMODE=require \
  CORS_ORIGINS=https://kavanasystemsinfo-ui.github.io,https://routeai.kavanasystems.com,https://www.routeai.kavanasystems.com

# Deploy
flyctl deploy --app kavana-routeai-api
```

### Variables obligatorias
| Variable | Valor | Nota |
|----------|-------|------|
| JWT_SECRET | (aleatorio, ≥32 chars) | Firma JWT. Rotado 2026-08-17 tras quedar expuesto en render.yaml |
| OFFICE_PIN | 9172 (prod) | PIN de la Torre de Control. La demo pública lo publicitaba como 0000; en Fly se configuró 9172 |
| PGHOST | ep-xxx.neon.tech | Host de Neon |
| PGUSER | neondb_owner | Usuario BD |
| PGPASSWORD | npg_xxx | Password BD |
| PGDATABASE | neondb | Nombre BD |
| PGPORT | 5432 | Puerto |
| PGSSLMODE | require | SSL obligatorio |
| CORS_ORIGINS | kavanasystemsinfo-ui.github.io, routeai.kavanasystems.com, www.routeai.kavanasystems.com | Orígenes permitidos |

### Health check
Endpoint `/health` responde inmediato sin autenticación.

---

## 3. Frontends — GitHub Pages

### Deploy workflow
`.github/workflows/deploy-combined.yml`:
- Build `client-admin/` (Torre de Control) → raíz del sitio
- Build `client/` (app repartidor) → `/app/`
- Publica en rama `gh-pages-admin`
- Sincroniza con `gh-pages`

### Secret necesario en GitHub
```
VITE_API_BASE=https://kavana-routeai-api.fly.dev
```
Sin este secret, los frontends apuntan a la API antigua. Cambiarlo requiere un nuevo push para redesplegar.

### Configurar GitHub Pages
1. Repo → Settings → Pages → Source: `gh-pages-admin` (root)
2. Custom domain: `www.routeai.kavanasystems.com`
3. Enforce HTTPS ✅

---

## 4. DNS — Namecheap

| Tipo | Host | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | Vercel proxy |
| CNAME | `routeai` | `kavanasystemsinfo-ui.github.io` |
| CNAME | `www.routeai` | `kavanasystemsinfo-ui.github.io` |
| CNAME | `manufacturing` | Vercel proxy |
| CNAME | `warehouse` | Vercel proxy |

---

## 5. CI/CD

### GitHub Actions
| Workflow | Trigger | Qué hace |
|----------|---------|----------|
| `ci.yml` | Push/PR a main | Tests backend + tests frontend + build frontend |
| `deploy-combined.yml` | Push a main | Build + deploy Torre Control + App a Pages |

### Tests
```bash
cd server && npm test    # 98 tests (todos async/await compatibles PG y JSON)
cd client && npm test    # 3 tests
cd client && npm run build  # Build verificado
```

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-07-29 | Migración JSON → PostgreSQL (Neon). Render deploy con IPv4 fix. DNS www.routeai |
| 2026-07-13 | Auditoría TDD + CI. Backend reconstruido |
| 2026-05-01 | Unificación de marca RouteFleet |
| 2026-04-29 | Motor IA DeepSeek. OCR. POD. MVP inicial |
