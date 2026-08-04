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
- Sin Google Play, se actualiza automáticamente. Nota honesta: no hay service
  worker, así que no funciona sin conexión (pendiente de implementar).

## Variables
- `VITE_API_BASE` (build-time) → `https://kavana-routeai-api.onrender.com`
  Sin slash final; el cliente añade `/api`.

## Build
```bash
cd client && npm install && npm run build   # → dist/ (base /app/)
```
