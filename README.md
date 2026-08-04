# KAVANA RouteFleet

Plataforma de gestión de repartos para empresas de reparto. Permite a los
repartidores escanear albaranes, entregar con firma del cliente (POD) y a las
oficinas hacer seguimiento de repartos por repartidor, ver firmas y KPIs.

## Arquitectura (todo fuera del VPS)

| Componente | Donde vive | URL |
|---|---|---|
| Backend API (Node/Express, store JSON) | Render | https://routefleet-api.onrender.com |
| App del repartidor (React PWA) | GitHub Pages (`/app`) | https://routefleet.kavanasystems.com/app |
| Panel oficinas "Torre de Control" (React) | GitHub Pages (`/`, rama `gh-pages-admin`) | https://routefleet.kavanasystems.com |

El VPS solo se usa para desarrollo/documentación. Los proyectos terminados
viven en servicios externos (Render + GitHub Pages), igual que CleanStock.

## Estructura del repo

```
server/            Backend Express + store JSON (sin SQLite)
  src/db.js              Capa de datos (stops, incidents, drivers, pods)
  src/routes/api.js      Endpoints REST
  src/services/          pdfService (POD), ocrService, aiService
  tests/                 36 tests (node --test) incl. autenticación JWT
client/            App del repartidor (Vite + React, base /app/)
client-admin/      Panel de oficinas Torre de Control (Vite + React, base /)
.github/workflows/ deploy-combined.yml (panel + app en gh-pages-admin)
```

## Desarrollo rápido

```bash
# Backend
cd server && npm install && npm test         # 36 tests verdes (incl. JWT)
ROUTEFLEET_DB=/tmp/dev.json PORT=5001 node src/index.js

# App repartidor
cd client && npm install && npm run dev       # http://localhost:5173

# Panel oficinas
cd client-admin && npm install && npm run dev  # http://localhost:5173
```

## Deploy

- **Backend**: Render (Web Service, rama `main`, Root `server`, start `node src/index.js`).
  Variables obligatorias: `JWT_SECRET` (cadena fuerte y aleatoria ≥32 chars — firma
  los JWT). `OFFICE_PIN` (PIN oficina, def. `0000`), `CORS_ORIGINS` (def. github.io
  + routefleet.kavanasystems.com). Todos los endpoints exigen JWT (oficina/driver).
- **Frontends**: un único workflow `deploy-combined.yml` builda app y panel y
  publica en `gh-pages-admin` (panel en `/`, app en `/app`). Secret repo
  `VITE_API_BASE=https://routefleet-api.onrender.com`. En Settings → Pages:
  rama `gh-pages-admin`, custom domain `routefleet.kavanasystems.com`.
- **DNS**: CNAME `routefleet` → `kavanasystemsinfo-ui.github.io`.

## Documentación

Ver `docs/` (ARQUITECTURA.md, BACKEND.md, APP_REPARTIDOR.md, PANEL_OFICINAS.md,
DESPLIEGUE.md, API.md).
