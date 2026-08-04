# Decisiones Técnicas — KAVANA Route AI

Este documento recoge las decisiones técnicas clave del proyecto y su fundamento.
Actualizado: Julio 2026.

---

## 1. Optimización de Rutas: 2-opt vs IA

### Decisión
Se eliminó la dependencia de OpenRouter (IA) para la optimización de rutas. Se reemplazó por un algoritmo **2-opt** local.

### Por qué
- **El problema del viajante (TSP)** es un problema geométrico clásico. Los algoritmos deterministas (2-opt, vecino más cercano) lo resuelven igual o mejor que una IA genérica, sin coste y sin latencia.
- La IA (Nemotron, GPT, Claude) no está entrenada específicamente para optimización logística. En nuestras pruebas, el modelo gratuito `nemotron-3-super-120b` producía rutas aceptables pero no óptimas, y `nemotron-nano-12b` devolvía el orden original sin optimizar.
- **Coste**: 0€ vs 0,10-0,50€ por llamada a IA.
- **Latencia**: milisegundos vs 20-30 segundos.
- **Disponibilidad**: funciona sin conexión, sin depender de terceros.

### Dónde está
- `server/src/services/routeOptimizer.js` — algoritmo 2-opt puro
- `server/src/routes/api.js` — endpoint `/api/optimize` simplificado

### Tradeoffs
- Necesita coordenadas (lat/lng) para funcionar → requiere geocodificación previa
- Las direcciones no geocodificables se quedan al final de la ruta

---

## 2. Geocodificación: Nominatim con Fallbacks

### Decisión
Se mejoró el geocodificador de Nominatim con múltiples estrategias de fallback y validación geográfica.

### Por qué
- Nominatim (OpenStreetMap) es **gratuito y sin API key**, ideal para un MVP.
- Pero es menos preciso que Google Maps. Direcciones con formato "Calle X, N - CP Ciudad (Zona)" a menudo fallan porque:
  - El prefijo "1       " (número de parada) rompe la búsqueda
  - Los paréntesis "(El Carmen)" confunden al parser
  - Calles con el mismo nombre existen en múltiples ciudades españolas
- Se implementaron **8 formatos de query** por dirección, probando desde el más específico al más genérico.
- Se añadió **validación de bounding box** (Valencia: 39.35-39.60, -0.45 - -0.30) para descartar resultados de otras ciudades.

### Dónde está
- `server/src/services/geocode.js` — lógica completa
- `server/src/services/addressCleaner.js` — patrones de direcciones españolas

### Tradeoffs
- Sigue siendo gratis pero menos preciso que Google Maps API
- ~80% de acierto en Valencia (12/15 direcciones en pruebas)
- Si se necesita precisión absoluta, migrar a Google Geocoding API (~5€/1000 peticiones)

---

## 3. OCR: Extracción de Direcciones de PDF

### Decisión
Se añadió limpieza de prefijos numéricos (números de parada) en las líneas extraídas del PDF.

### Por qué
- Los albaranes de reparto tienen formato tabular: `N       Calle X, N - CP Ciudad`
- `pdftotext` preserva el layout, devolviendo `"1       Calle de Russafa, 8 - 46004 Valencia"`
- Sin limpiar el prefijo, la dirección se almacena como `"1 Calle de Russafa..."`, lo que rompe la geocodificación porque Nominatim interpreta el "1" como número de edificio.

### Dónde está
- `server/src/routes/api.js` — endpoint `/api/ocr`, línea con `replace(/^\d+\s{2,}/, '')`
- `server/src/services/ocrService.js` — extracción de texto con pdftotext

### Tradeoffs
- El regex `^\d+\s{2,}` requiere 2+ espacios, seguro para direcciones legítimas que empiezan con número ("45 Madison Street" → 1 espacio, no se limpia)

---

## 4. Despliegue: GitHub Actions + Pages vs Vercel

### Decisión
El frontend (Torre de Control + app repartidor) se despliega con GitHub Actions a GitHub Pages.
El backend (API NestJS) se despliega en Render.

### Por qué
- Los frontends son SPAs puras (React + Vite) → GitHub Pages es suficiente y gratuito
- El backend necesita Node.js persistente → Render (plan gratuito)
- Vercel no aporta ventajas sobre Pages para SPAs estáticas, y añade complejidad al dividir el proyecto en más plataformas

### Dónde está
- `.github/workflows/deploy-combined.yml` — build + deploy automático
- `render.yaml` — configuración de Render

---

## 5. Diseño Visual: Torre de Control

### Decisión
- Sidebar con textura de asfalto real (imagen PNG proporcionada por el usuario)
- Acento amarillo `#f8cd00` (branding RouteAI) en lugar de azul para el tema Clásico
- Texto negro sobre botones seleccionados para contraste

### Por qué
- El branding de RouteAI usa amarillo (#f8cd00). Unificar el acento refuerza la identidad visual.
- El asfalto en el sidebar es una metáfora visual del negocio (rutas, reparto, carreteras).
- Contraste texto negro sobre amarillo cumple WCAG AA.

### Dónde está
- `client-admin/src/App.jsx` — componente principal con temas y sidebar
- `client-admin/public/asphalt.png` — textura de asfalto

---

## Stack actual

| Componente | Tecnología |
|---|---|
| Frontend (Torre de Control) | React 18 + Vite |
| Frontend (App repartidor) | React 18 + Vite + PWA |
| Backend API | Node.js + Express + NestJS |
| Base de datos | PostgreSQL (Neon/Supabase) |
| Geocodificación | Nominatim (OpenStreetMap) |
| Optimización rutas | 2-opt local (sin IA) |
| OCR | pdftotext (poppler-utils) |
| Hosting frontend | GitHub Pages |
| Hosting backend | Render |
| CI/CD | GitHub Actions |
