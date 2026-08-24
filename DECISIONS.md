# Decisiones Técnicas — KAVANA Route AI

Este documento recoge las decisiones técnicas clave del proyecto y su fundamento.
Actualizado: Julio 2026.

> Las decisiones detalladas con alternativas evaluadas están en [`docs/adr/`](./docs/adr/).

---

## 1. Optimización de Rutas: 2-opt vs IA

**ADR:** [`docs/adr/001-reemplazo-ia-por-2opt.md`](./docs/adr/001-reemplazo-ia-por-2opt.md)

### Decisión
Se reemplazó la dependencia de OpenRouter (IA) para la optimización de rutas y se implementó un algoritmo **2-opt** (búsqueda local) desde cero.

### Por qué
- **El problema del viajante (TSP)** es un problema geométrico clásico. Los algoritmos deterministas (2-opt, vecino más cercano) lo resuelven con precisión reproducible, sin coste y sin latencia de red.
- La IA (Nemotron, GPT, Claude) no está entrenada específicamente para optimización logística. En pruebas, `nemotron-3-super-120b` producía rutas aceptables pero no óptimas, y `nemotron-nano-12b` devolvía el orden original sin optimizar.
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

**ADR:** [`docs/adr/002-geocodificacion-nominatim-fallbacks.md`](./docs/adr/002-geocodificacion-nominatim-fallbacks.md)

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

*(Sin ADR separado — decisión menor documentada aquí)*

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

**ADR:** [`docs/adr/005-despliegue-github-pages-render.md`](./docs/adr/005-despliegue-github-pages-render.md)

### Decisión
El frontend (Torre de Control + app repartidor) se despliega con GitHub Actions a GitHub Pages.
El backend (API Express) se despliega en Fly.io.

### Por qué
- Los frontends son SPAs puras (React + Vite) → GitHub Pages es suficiente y gratuito
- El backend necesita Node.js persistente → Fly.io (máquina 256MB con volumen persistente para PODs/fotos, auto-stop sin suspender)
- Migrado desde Render free (suspendía el servicio al agotar horas). Vercel no aporta ventajas sobre Pages para SPAs estáticas

### Dónde está
- `.github/workflows/deploy-combined.yml` — build + deploy automático
- `fly.toml` + `server/Dockerfile` — configuración de Fly.io
- `render.yaml` — histórico (ya NO operativo)

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

## 6. Checklist de bultos en app del repartidor

*(Decisión menor documentada aquí, sin ADR separado)*

### Decisión
Se implementó un sistema de checklist de productos/bultos en la app del repartidor. El placeholder gris "Confirmar bultos al entregar" se reemplazó por un modal funcional donde el conductor añade productos con cantidad, los marca como entregados y se guardan con la parada.

### Por qué
- El flujo real de reparto requiere que el conductor verifique qué productos entrega
- Sin esto, no hay control sobre si se entregó todo o faltó algo
- Los bultos aparecen en el PDF del POD y en la columna "Bultos" de la Torre de Control

### Dónde está
- `client/src/components/ItemsModal.jsx` — modal de gestión de bultos
- `client/src/App.jsx` — integración en el flujo de entrega
- `client/src/services/podService.js` — inclusión en el PDF del POD
- `client-admin/src/App.jsx` — columna "Bultos" en Repartos
- `server/src/db.js` — campo `items` (JSON) en tabla stops

---

## 7. Incidencias: carga desde tabla propia

### Decisión
El panel de incidencias cargaba desde `stops?status=incident` (paradas filtradas), pero los datos reales están en la tabla `incidents`. Se creó `GET /api/incidents` que devuelve las incidencias reales con nombre del conductor y dirección. Las fotos pasaron de base64 en BD a archivos en disco.

### Por qué
- Las incidencias se guardaban en `incidents` pero el panel leía de `stops`
- Los campos `type`, `notes`, `photo_data` no existen en `stops`
- Las fotos en base64 ocupaban 2-10MB cada una en la BD

### Dónde está
- `server/src/routes/api.js` — endpoint `GET /api/incidents`
- `server/src/db.js` — función `listIncidents`
- `server/src/index.js` — ruta estática `/incidents`
- `client-admin/src/App.jsx` — panel ahora usa `/api/incidents`

---

## 8. Bugfix: Foreign keys al borrar paradas

### Decisión
`DELETE FROM stops` fallaba (500) por FK a `incidents` y `pods`. Se modificaron `clearStops` y `deleteStop` para borrar hijos primero.

### Por qué
- PostgreSQL no permite borrar padre si hay hijos referenciándolo
- Afectaba al botón "BORRAR RUTA" de la app del repartidor

### Dónde está
- `server/src/db.js` — funciones `clearStops` y `deleteStop`

---

## 9. Blindaje de la demo: datos históricos inmutables + datos de visitante 24h

**ADR:** [`docs/adr/007-blindaje-demo.md`](./docs/adr/007-blindaje-demo.md)

### Decisión
La demo de portfolio incluye 90 días de historia generada (`seed-historico.js`). Esos datos se marcan `is_demo=true` y quedan **solo lectura**: los 6 repartidores no pueden iniciar sesión (403), no se editan ni borran, y sus paradas tampoco. Todo lo que crea un visitante (repartidores, albaranes, paradas) lleva `session_id` y `expira_en` (24h), y un cron diario borra lo caducado.

### Por qué
- La demo debe verse como una empresa viva, no como un sandbox que cualquiera contamina.
- Un reclutador debe poder **probar la app** (crear repartidores, entregar con firma) sin destrozar el histórico.
- Sin caducidad, los datos de prueba se acumularían indefinidamente en la BD de producción.

### Dónde está
- `server/src/db.js` — columnas `is_demo`/`session_id`/`expira_en`, `cleanupExpired`
- `server/src/routes/api.js` — bloqueos 403 en login/PATCH/DELETE, endpoint `/api/cleanup-expired`
- `client-admin/src/App.jsx` — etiqueta "demo · solo lectura", candados, `session_id` en localStorage

### Tradeoffs
- Los repartidores demo no pueden probar la app con sus PIN: hay que crear uno propio (2 clics en la Torre de Control)
- El cron de limpieza depende de que Hermes esté activo (patrón no_agent, silencioso)

---

## 10. Simulación diaria: la demo sigue viva sin intervención

### Decisión
`server/simulate-daily.js` se ejecuta cada madrugada (cron 06:00): resuelve pendientes de días anteriores, cierra jornadas activas con km plausible, abre la jornada de hoy con el odómetro continuando, y genera las rutas pendientes del día (15-30 paradas; sábados menos, domingos descanso). Idempotente: si hoy ya hay paradas, no duplica.

### Por qué
- Sin esto, la demo se congela: en 4 días no habría paradas de hoy y parecería una empresa abandonada.
- Reutiliza el mismo patrón de `seed-historico.js` (misma semilla, misma distribución de estados).

### Dónde está
- `server/simulate-daily.js`

---

## 11. Formato numérico español en toda la interfaz

### Decisión
Todas las cifras de la Torre de Control se formatean en español: punto de miles (12.415), coma decimal (43,5), sin decimales si no los tiene (43). Implementado con formateo manual (`fmtNum`/`fmtEuro`), **no** con `toLocaleString('es-ES')`.

### Por qué
- Los km vienen de PostgreSQL como `NUMERIC(10,3)` y se mostraban como `43.000` (leíble como "43 mil").
- `toLocaleString('es-ES')` omite el punto de miles cuando el grupo más alto tiene 1 dígito (5314 → "5314"), algo inaceptable en una demo en español.

### Dónde está
- `client-admin/src/App.jsx` — funciones `fmtNum` y `fmtEuro`

---

## 12. OPEX: solo el real, no estimaciones inventadas

### Decisión
Se eliminó la tarjeta "OPEX est." del dashboard. Solo se muestra el **OPEX real**: km registrados en jornadas cerradas × coste por tipo de combustible.

### Por qué
- La fórmula fija del estimado (entregas × 8 km + × 0,5 h) inflaba el kilometraje ~4,5x (88.288 km estimados vs 19.554 km reales) y mostraba 126.914 € frente a los 5.476 € reales. Era una cifra que no resistía una pregunta de un reclutador.

### Dónde está
- `client-admin/src/App.jsx` — cálculo de `opexReal` desde sesiones de conductores

---

## 13. Filtro de periodo global + rendimiento

### Decisión
Selector de periodo arriba de la Torre de Control (Mes actual por defecto, Mes anterior, Esta semana, Todo el histórico, Personalizado) que aplica a todas las pestañas. El listado de paradas **ya no incluye la firma base64** (el POD la genera bajo demanda): el payload bajó de ~15 MB a ~5 MB.

### Por qué
- Cargar 12.341 paradas con 11 MB de firmas base64 en cada apertura hacía la demo lenta en móvil (6+ s).
- El histórico no se pierde: con "Todo el histórico" se ve completo.

### Dónde está
- `server/src/routes/api.js` — `from`/`to` en `/stops`, `/incidents`, `/driver/sessions`, `/dashboard-data`
- `client-admin/src/App.jsx` — selector de periodo

---

## Stack actual

| Componente | Tecnología |
|---|---|
| Frontend (Torre de Control) | React 18 + Vite |
| Frontend (App repartidor) | React 18 + Vite + web responsive |
| Backend API | Node.js + Express |
| Base de datos | PostgreSQL (Neon) + JSON fallback local |
| Geocodificación | Nominatim (OpenStreetMap) |
| Optimización rutas | 2-opt local (sin IA) |
| OCR | Tesseract.js + pdftotext (poppler-utils) |
| Hosting frontend | GitHub Pages |
| Hosting backend | Fly.io |
| CI/CD | GitHub Actions |

---

## Estado actual del proyecto (agosto 2026)

**Tests**: 94 (91 server + 3 client). **Endpoints**: 25. **ADRs**: 7.

**Refactor completado (P1-P7):**
- Seguridad: autorización por ownership JWT, rate limiting de login, endpoints protegidos
- API: modularizada en 6 módulos de ruta (auth, drivers, stops, ocr, optimization, admin)
- Frontend: hooks useAuth y useData extraídos (App.jsx con migración planificada)
- 2-opt: tests con invariantes, benchmark y determinismo

**Limitaciones documentadas**: PINs sin hash (prioridad MVP), JWT en localStorage (SPA cross-origin sin BFF).
