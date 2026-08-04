# API REST — KAVANA Route AI

Base: `https://kavana-routeai-api.onrender.com/api`

> **Auth**: todos los endpoints de datos exigen `Authorization: Bearer <JWT>`.
> Roles: `office` (Torre de Control) y `driver` (app repartidor). Sin token → `401`;
> rol incorrecto → `403`. El PIN de oficina es `OFFICE_PIN` (def. `0000`), el del
> repartidor demo es `DEFAULT_DRIVER_PIN` (def. `5855`).

## Autenticación
- `POST /drivers/login` → Body `{pin}`. 200 + `{token, driver}` si el PIN es válido y el repartidor está activo; 401 si no.
- `POST /office/login` → Body `{pin}`. 200 + `{token}` si coincide con `OFFICE_PIN`; 401 si no.

## Paradas (stops)
- `GET /stops` → lista (role `office` o `driver`). Query: `?driver_id=1&status=delivered&from=2026-07-01&to=2026-07-31`
- `POST /stops/bulk` (role `driver` u `office`) → crea varias paradas desde OCR. Body: `{addresses, items, driver_id}`. Los items (bultos) se guardan en la primera parada.
- `POST /ocr_manual` (role `driver`) → crea una parada manual. Body: `{stop_number, address, driver_id}`
- `PATCH /stops/:id` (role `driver`) → actualiza. Body: `{status, signature, receiverName, items, delivery_notes, address}`.
  Si `status=delivered` + `signature`, genera el POD y devuelve `{success, pod_url}`.
- `DELETE /stops/:id` (role `driver` u `office`) · `DELETE /stops` (borra todas)
- `POST /stops/:id/incident` (role `driver`) → Body `{type, photo_data, notes}` (guarda la foto en disco y pone `status=incident`)
- `GET /stops/:id/pod` (role `office` o `driver`; también `?token=`) → redirige al PDF del POD (lo regenera si hace falta)

## Repartidores (drivers)
- `GET /drivers` (role `office`) · `POST /drivers` (role `office`) → Body `{name, pin, phone, email}` (envía email de bienvenida si hay SMTP)
- `PATCH /drivers/:id` (role `office`) → Body `{active: bool, fuel_type: string, cost_per_km: number}`.
  El **supervisor asigna el tipo de combustible** (diesel/gasolina/hibrido/electrico) desde aquí.

## Jornadas del repartidor (driver_sessions)
- `POST /driver/session/start` (role `driver`) → Body `{km_initial}`. Abre la jornada.
- `POST /driver/session/end` (role `driver`) → Body `{km_final}`. Cierra y devuelve `{km_total}`.
- `GET /driver/session` (role `driver`) → sesión activa del repartidor.
- `GET /driver/sessions` (role `office`) → historial de jornadas de todos los repartidores (con nombre del conductor).

## OCR
- `POST /ocr` (sin auth, multipart `image`) → procesa albarán (PDF/CSV/imagen) y devuelve `{addresses, items, detectedAddress, totalItems}`.
  Usa Tesseract.js + pdftotext + addressCleaner.

## Optimización de rutas
- `POST /optimize` → ordena las paradas con **2-opt local** (sin IA). Body: `{stops, origin}`.
  Geocodifica con Nominatim y devuelve `{success, message, stops, unlocated}`.

## Incidencias
- `GET /incidents` (role `office`) → lista enriquecida (con nombre del repartidor y dirección de la parada).

## Config / métricas
- `GET /settings` (role `office`) · `PUT /settings` → `{cost_per_km, cost_per_hour, cost_per_km_diesel, cost_per_km_gasolina, cost_per_km_hibrido, cost_per_km_electrico}`
- `GET /dashboard-data` (role `office`) → `{metrics, stops (con pod_url), settings}`

## PODs (estáticos)
- `GET /pods/<file>.pdf` → descarga del PDF
