# Despliegue — KAVANA Route AI (actualizado 2026-07-29)

## Arquitectura de despliegue

| Componente | Donde vive | URL |
|------------|-----------|-----|
| Backend API (Node/Express) | Render | https://kavana-routeai-api.onrender.com |
| Base de datos PostgreSQL | Neon (serverless) | — |
| Panel oficinas "Torre de Control" | GitHub Pages | https://www.routeai.kavanasystems.com |
| App del repartidor (React PWA) | GitHub Pages (/app) | https://www.routeai.kavanasystems.com/app |
| APK Android | GitHub Pages (/download) | https://www.routeai.kavanasystems.com/download/routeai.apk |

---

## 1. Base de datos — Neon (PostgreSQL)

**Ya no usamos JSON store en producción.** PostgreSQL via Neon, persistente y gratis.

### Crear base de datos
1. https://neon.tech → Sign in with GitHub → Create project (region EU West)
2. Copiar connection string o usar variables individuales

### Variables de entorno en Render
```
PGHOST=ep-xxxx.eu-central-1.aws.neon.tech
PGUSER=neondb_owner
PGPASSWORD=npg_xxx
PGDATABASE=neondb
PGPORT=5432
PGSSLMODE=require
```

**⚠️ PITFALL — Prioridad de variables:** El código revisa primero `PGHOST`; si existe, usa Neon. Si no, usa `DATABASE_URL`. Si ninguna, fallback a JSON store (solo dev).

**⚠️ PITFALL — Supabase solo da IPv6:** Supabase free tier solo responde por IPv6. Render free solo tiene salida IPv4. **No usar Supabase con Render free.** Usar Neon.

---

## 2. Backend — Render

### Blueprint (render.yaml)
El archivo `render.yaml` en la raíz del repo describe el servicio:

```yaml
services:
  - type: web
    name: kavana-routeai-api
    runtime: node
    rootDir: server
    buildCommand: npm install
    startCommand: node src/index.js
    healthCheckPath: /health
```

### Crear servicio
1. https://dashboard.render.com → New → Blueprint → repo `kavana-RouteAI`
2. Render lee `render.yaml` y crea el servicio automáticamente
3. Añadir variables de entorno manualmente (ver sección 1)
4. Manual Deploy → Deploy latest commit

### Variables obligatorias
| Variable | Valor | Nota |
|----------|-------|------|
| PGHOST | ep-xxx.neon.tech | Host de Neon |
| PGUSER | neondb_owner | Usuario BD |
| PGPASSWORD | npg_xxx | Password BD |
| PGDATABASE | neondb | Nombre BD |
| PGPORT | 5432 | Puerto |
| PGSSLMODE | require | SSL obligatorio |
| JWT_SECRET | (auto-generado) | Firma JWT |
| OFFICE_PIN | 0000 | CAMBIAR en producción |

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
VITE_API_BASE=https://kavana-routeai-api.onrender.com
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
| `build-apk.yml` | Manual | Compila APK Android firmado |

### Tests
```bash
cd server && npm test    # 40+ tests (todos async/await compatibles PG y JSON)
cd client && npm test    # 2 tests
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
