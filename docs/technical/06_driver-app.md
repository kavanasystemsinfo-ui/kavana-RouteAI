# App del Repartidor — KAVANA Route AI

React SPA (carpeta `client/`). Desplegada en GitHub Pages en
`routeai.kavanasystems.com/app/` (subpath `/app`). Estética oscura
industrial, pensada para móvil.

## Pantalla de identificación (PIN + JWT)
Al abrir la app, si no hay token guardado, pide el PIN del repartidor.
`POST /api/drivers/login` valida el PIN y devuelve un **JWT** que se guarda
en `localStorage` (`routeai_driver_token`). Todas las llamadas del
repartidor envían ese JWT en `Authorization: Bearer ***`

## Funciones
- **Carga**: escáner de albarán (cámara) → `POST /api/ocr` → crea parada
  con `driver_id` vía `POST /api/ocr_manual` (requiere JWT driver).
- **Mapa**: vista de la parada activa (Google Maps embed).
- **Entregar**: firma del cliente en canvas (blanco, trazo negro) →
  `PATCH /stops/:id` con firma (requiere JWT driver) → genera POD en el
  navegador (jsPDF) y descarga garantizada (`DESCARGAR POD`). También sube la
  firma al backend.
- **Incidencia**: foto + nota → `POST /stops/:id/incident` (requiere JWT driver).

## Distribución
La app es una **web responsive** (SPA) accesible desde el navegador del móvil:
- El repartidor abre `https://routeai.kavanasystems.com/app` en su navegador
  móvil y, si quiere, pulsa "Añadir a pantalla de inicio" (icono de acceso directo).
- Sin Google Play, se actualiza automáticamente. **No hay service worker
  (decisión confirmada, ADR-001)**: el repartidor trabaja siempre con conexión
  de datos móviles (recibe la ruta y envía cada entrega en tiempo real), así
  que el offline no aporta valor al flujo real. Los assets se cachean con los
  hashes de Vite (el cache-bust agresivo del index.html se retiró en 2026-08-17).

## Variables
- `VITE_API_BASE` (build-time) → `https://kavana-routeai-api.fly.dev`
  Sin slash final; el cliente añade `/api`.

## Build
```bash
cd client && npm install && npm run build   # → dist/ (base /app/)
```
