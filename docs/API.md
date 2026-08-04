# API REST — KAVANA RouteFleet

Base: `https://routefleet-api.onrender.com/api`

> **Auth**: todos los endpoints exigen `Authorization: Bearer *** (JWT).
> Roles: `office` (panel) y `driver` (app repartidor). Sin token → `401`;
> rol incorrecto → `403`. El PIN de oficina es `OFFICE_PIN` (def. `0000`).

## Paradas (stops)
- `GET /stops` → lista (role `office` o `driver`). Query: `?driver_id=1&status=delivered&from=2026-07-01&to=2026-07-31`
- `POST /ocr_manual` → crea parada (role `driver`). Body: `{stop_number, address, driver_id}`
- `PATCH /stops/:id` → actualiza (role `driver`). Body: `{status, signature, receiverName, driver_id}`.
  Si `status=delivered` y `signature`, genera POD y devuelve `{success, pod_url}`.
- `DELETE /stops/:id` (role `driver`) · `DELETE /stops` (role `driver`, borra todas)
- `POST /stops/:id/incident` (role `driver`) → Body `{type, photo_data, notes}` (pone status=incident)
- `GET /stops/:id/pod` → `{pod_url}` (role `office` o `driver`; también `?token=`)

## Repartidores (drivers)
- `GET /drivers` (role `office`) · `POST /drivers` (role `office`) → Body `{name, pin, phone}`
- `PATCH /drivers/:id` (role `office`) → Body `{active: bool}`
- `POST /drivers/login` → Body `{pin}`. 200 + `{token, driver}` si el PIN es válido; 401 si no.

## Oficina
- `POST /office/login` → Body `{pin}`. 200 + `{token}` si coincide con `OFFICE_PIN`; 401 si no.

## Config / métricas
- `GET /settings` (role `office`) · `PUT /settings` (`{cost_per_km, cost_per_hour}`)
- `GET /dashboard-data` (role `office`) → `{metrics, stops (con pod_url), settings}`

## PODs (estáticos)
- `GET /pods/<file>.pdf` → descarga del PDF
