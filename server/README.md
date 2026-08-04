# KAVANA Route AI — Backend (API REST)

Servidor Express que da soporte a la plataforma de optimización inteligente de rutas: gestión de
paradas, OCR de albaranes, optimización de rutas (IA con fallback local) y
generación de POD (Proof of Delivery) en PDF.

## Stack
- Express 4
- multer (subida de imágenes OCR)
- pdfkit (generación de POD)
- pg (PostgreSQL — Neon en producción, JSON fallback en local)
- tesseract.js (OCR de imágenes, opcional)
- Node 20 (`node --test` para tests, sin dependencias extra)

## Puertos
- API REST: `5001`

## Variables de entorno
- `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` (producción): PostgreSQL en Neon.
  Sin ellas, el server usa el JSON store local.
- `PORT` (opcional, defecto 5001)

## Scripts
- `npm start` — arranca el servidor
- `npm run dev` — arranca con recarga automática (`node --watch`)
- `npm test` — ejecuta la suite de tests (`node --test`)

## Estructura
```
src/
  index.js              # arranque Express + inyección de DB
  db.js                 # capa de datos (PostgreSQL en prod, JSON en local)
  routes/api.js         # endpoints REST
  services/
    addressCleaner.js   # limpieza semántica de direcciones OCR
    ocrService.js       # OCR de albaranes (Tesseract opcional)
    routeOptimizer.js   # algoritmo greedy + 2-opt de rutas (sin IA)
    pdfService.js       # generación de POD en PDF
tests/                  # suite node:test (sin frameworks externos)
```

## Tests
La suite cubre la lógica pura y los servicios:
- `addressCleaner` — limpieza de símbolos y materiales industriales
- `routeOptimizer` — orden greedy determinista
- `db` — altas/bajas/consultas (PostgreSQL y JSON)
- `pdfService` — genera un PDF válido con firma y geolocalización
- `ocrService` — procesamiento de imagen sin fallar si no hay Tesseract

Ejecutar: `npm test`
