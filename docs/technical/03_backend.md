# Backend — KAVANA RouteFleet

Node/Express, store en JSON (sin SQLite). Todo desplegado en Render
(`routefleet-api`). **36 tests** con `node --test` (incluye autenticación JWT).

## Arranque
```bash
cd server
npm install
npm test                # 36 tests verdes (incl. JWT)
ROUTEFLEET_DB=/tmp/dev.json PORT=5001 node src/index.js
```

## Variables de entorno
| Var | Def. | Uso |
|---|---|---|
| `PORT` | 5001 | Puerto |
| `ROUTEFLEET_DB` | `./routefleet.json` | Ruta del store JSON |
| `JWT_SECRET` | `routefleet-dev-secret-change-me` | **Obligatoria en prod**: clave HS256 para firmar JWT (usar cadena ≥32 chars aleatoria) |
| `OFFICE_PIN` | `0000` | PIN de login de oficina |
| `CORS_ORIGINS` | github.io + routefleet.kavanasystems.com | Orígenes CORS |

## Autenticación (JWT HS256)
- `src/auth.js`: firma/verifica con `crypto` nativo (sin dependencias).
  `signToken(payload)`, `verifyToken(token)`, `extractToken(req)` (header
  `Authorization: Bearer *** o query `?token=`), `requireAuth(roles)`.
- `POST /api/office/login` → `{token}` (role `office`, exp 8h).
- `POST /api/drivers/login` → `{token, driver}` (role `driver`).
- Todos los endpoints de datos exigen JWT (ver `API.md`). Sin token → `401`;
  rol incorrecto → `403`.

## Capa de datos (`src/db.js`)
Store JSON con interfaz agnóstica (`initDb()`, `queries.*`):
- `stops`: `[{id, stop_number, address, status, driver_id, receiver_name, signature, created_at}]`
- `drivers`: `[{id, name, pin, phone, active}]`
- `incidents`: `[{id, stop_id, type, photo_data, notes, created_at}]`
- `settings`: `{cost_per_km, cost_per_hour}`
- `pods`: `{[stopId]: url}`

## Servicios
- `pdfService.js`: genera el POD (PDF) con firma negra sobre blanco (pdfkit).
- `ocrService.js`: OCR con Tesseract.js + pdftotext (poppler) + fallback a regex de direcciones. Detección de binario por magic bytes.
- `aiService.js`: optimización de ruta con DeepSeek vía OpenRouter + fallback a algoritmo greedy local (sin red).
- `routeOptimizer.js`: algoritmo greedy de optimización de rutas (fallback local).
- `geocode.js`: geocodificación de direcciones con OpenStreetMap Nominatim + caché.
- `addressCleaner.js`: limpieza y normalización de direcciones extraídas vía OCR.
- `emailService.js`: envío de email de bienvenida al repartidor con instrucciones y PIN.
