# App del Repartidor — KAVANA RouteFleet

React PWA (carpeta `client/`). Desplegada en GitHub Pages en
`routefleet.kavanasystems.com/app/` (subpath `/app`). Estética oscura
industrial, pensada para móvil.

## Pantalla de identificación (PIN + JWT)
Al abrir la app, si no hay token guardado, pide el PIN del repartidor.
`POST /api/drivers/login` valida el PIN y devuelve un **JWT** que se guarda
en `localStorage` (`routefleet_driver_token`). Todas las llamadas del
repartidor envían ese JWT en `Authorization: Bearer ***`

## Funciones
- **Carga**: escáner de albarán (cámara) → `POST /api/ocr` (IA) → crea parada
  con `driver_id` vía `POST /api/ocr_manual` (requiere JWT driver).
- **Mapa**: vista de la parada activa (Google Maps embed).
- **Entregar**: firma del cliente en canvas (blanco, trazo negro) →
  `PATCH /stops/:id` con firma (requiere JWT driver) → genera POD en el
  navegador (jsPDF) y descarga garantizada (`DESCARGAR POD`). También sube la
  firma al backend.
- **Incidencia**: foto + nota → `POST /stops/:id/incident` (requiere JWT driver).

## Distribución
La app se distribuye exclusivamente como **PWA** (Progressive Web App):
- El repartidor abre `https://routefleet.kavanasystems.com/app` en su navegador
  móvil y pulsa "Añadir a pantalla de inicio".
- Funciona como app nativa: icono en el móvil, pantalla completa, sin necesidad
  de Google Play, se actualiza automáticamente.

## Variables
- `VITE_API_BASE` (build-time) → `https://routefleet-api.onrender.com`
  Sin slash final; el cliente añade `/api`.

## Build
```bash
cd client && npm install && npm run build   # → dist/ (base /app/)
```
