# Backend — KAVANA Route AI

Node/Express, PostgreSQL (Neon) en producción con fallback a JSON store en
local. Desplegado en Fly.io (`kavana-routeai-api`, ver `server/Dockerfile` +
`server/fly.toml`). **68 tests** con `node --test` (incluye autenticación JWT).

## Arranque
```bash
cd server
npm install
npm test                # 68 tests verdes (incl. JWT)
ROUTEAI_DB=/tmp/dev.json PORT=5001 node src/index.js
```

## Variables de entorno
| Var | Def. | Uso |
|---|---|---|
| `PORT` | 5001 | Puerto |
| `ROUTEAI_DB` | `./routeai.json` | Ruta del store JSON (fallback local) |
| `JWT_SECRET` | `routeai-dev-secret-change-me` | **Obligatoria en prod**: clave HS256 para firmar JWT (usar cadena ≥32 chars aleatoria) |
| `OFFICE_PIN` | `0000` | PIN de login de oficina |
| `CORS_ORIGINS` | github.io + routeai.kavanasystems.com | Orígenes CORS |
| `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | Neon | PostgreSQL en producción |

## Autenticación (JWT HS256)
- `src/auth.js`: firma/verifica con `crypto` nativo (sin dependencias).
  `signToken(payload)`, `verifyToken(token)`, `extractToken(req)` (header
  `Authorization: Bearer *** o query `?token=`), `requireAuth(roles)`.
- `POST /api/office/login` → `{token}` (role `office`, exp 8h).
- `POST /api/drivers/login` → `{token, driver}` (role `driver`).
- Todos los endpoints de datos exigen JWT (ver `API.md`). Sin token → `401`;
  rol incorrecto → `403`.

## Capa de datos (`src/db.js`)
Capa agnóstica (`initDb()`, `queries.*`) con backend PostgreSQL (pg) en
producción y JSON store en local:
- `stops`: `[{id, stop_number, address, status, driver_id, receiver_name, signature, created_at}]`
- `drivers`: `[{id, name, pin, phone, active}]`
- `incidents`: `[{id, stop_id, type, photo_data, notes, created_at}]`
- `settings`: `{cost_per_km, cost_per_hour}`
- `pods`: `{[stopId]: url}`

## Servicios
- `pdfService.js`: genera el POD (PDF) con firma negra sobre blanco (pdfkit).
- `ocrService.js`: OCR con Tesseract.js + pdftotext (poppler) + fallback a regex de direcciones. Detección de binario por magic bytes.
- `routeOptimizer.js`: algoritmo greedy + 2-opt de optimización de rutas (local, determinista, sin IA).
- `geocode.js`: geocodificación de direcciones con OpenStreetMap Nominatim + caché.
- `addressCleaner.js`: limpieza y normalización de direcciones extraídas vía OCR.
- `emailService.js`: envío de email de bienvenida al repartidor con instrucciones y PIN.
