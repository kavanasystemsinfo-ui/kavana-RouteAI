# KAVANA RouteFleet — Backend (API REST)

Servidor Express que da soporte al cliente de logística de campo: gestión de
paradas, OCR de albaranes, optimización de rutas (IA con fallback local) y
generación de POD (Proof of Delivery) en PDF.

## Stack
- Express 4
- better-sqlite3 (almacenamiento local)
- multer (subida de imágenes OCR)
- pdfkit (generación de POD)
- Node 20 (`node --test` para tests, sin dependencias extra)

## Puertos
- API REST: `5001`

## Variables de entorno
- `OPENROUTER_API_KEY` (opcional): si existe, la optimización de rutas usa
  DeepSeek v3 vía OpenRouter. Si falta o falla, se aplica un algoritmo greedy
  local (vecino más cercano) — el reparto nunca se detiene.
- `PORT` (opcional, defecto 5001)

## Scripts
- `npm start` — arranca el servidor
- `npm run dev` — arranca con recarga automática (`node --watch`)
- `npm test` — ejecuta la suite de tests (`node --test`)

## Estructura
```
src/
  index.js              # arranque Express + inyección de DB
  db.js                 # esquema SQLite + queries (mejor-sqlite3)
  routes/api.js         # endpoints REST
  services/
    addressCleaner.js   # limpieza semántica de direcciones OCR
    ocrService.js       # OCR de albaranes (Tesseract opcional)
    aiService.js        # optimización de rutas (IA + fallback greedy)
    routeOptimizer.js   # algoritmo greedy de vecino más cercano
    pdfService.js       # generación de POD en PDF
tests/                  # suite node:test (sin frameworks externos)
```

## Tests
La suite cubre la lógica pura y los servicios:
- `addressCleaner` — limpieza de símbolos y materiales industriales
- `routeOptimizer` — orden greedy determinista
- `aiService` — fallback a greedy sin API key
- `db` — altas/bajas/consultas SQLite
- `pdfService` — genera un PDF válido con firma y geolocalización
- `ocrService` — procesamiento de imagen sin fallar si no hay Tesseract

Ejecutar: `npm test`
