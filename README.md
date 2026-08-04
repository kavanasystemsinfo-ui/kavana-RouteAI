# KAVANA ROUTE AI

> **Gestión de repartos de última milla: optimización de rutas con algoritmo 2-opt, app web del repartidor con OCR de albaranes, firma digital del cliente y torre de control para la oficina.**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![Express](https://img.shields.io/badge/Express-API-lightgrey)
![Web](https://img.shields.io/badge/Web-Responsive-blue)
![OCR](https://img.shields.io/badge/OCR-Tesseract-8A2BE2)
![Tests](https://img.shields.io/badge/Tests-48-success)
![License](https://img.shields.io/badge/License-MIT-success)

---

## ⚡ 30 Segundos

Kavana Route AI digitaliza el ciclo completo de un reparto: la oficina carga el albarán (OCR extrae la dirección y los bultos), el repartidor recibe la ruta optimizada en su móvil (web responsive, pensada para pantalla de inicio), entrega con firma del cliente y vuelve con la evidencia en PDF. Todo en una única plataforma.

La optimización de rutas usa un **algoritmo 2-opt local**: determinista, instantáneo y sin coste por llamada. Se descartó la IA genérica tras comprobar que no mejoraba las rutas.

---

## 🏗️ Arquitectura

```
          Repartidor (web)           Oficina (Torre de Control)
                    │                          │
                    └────────────┬─────────────┘
                                 ▼
                     API REST (Express + JWT)
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                 OCR        Optimización    POD (PDF)
              (Tesseract)     2-opt         firma digital
                    │
                    ▼
        PostgreSQL (Neon) + JSON fallback
```

- **App del repartidor**: web responsive pensada para móvil (icono en pantalla de inicio). El ADR-001 evaluó PWA/nativa; hoy no hay service worker, es una SPA web.
- **Torre de control**: panel de la oficina para cargar rutas, verificar bultos y seguir entregas.
- **OCR**: extrae dirección y bultos del albarán (Tesseract.js + pdftotext + addressCleaner).
- **Despliegue**: backend en Render (`kavana-routeai-api`), frontends en GitHub Pages.

---

## 🧠 Decisiones clave

| Decisión | Alternativas | Elegida | Por qué |
|----------|-------------|---------|---------|
| Optimización | IA (OpenRouter), greedy | **2-opt local** | Determinista, instantáneo, sin coste. La IA no mejoraba las rutas (ADR-001) |
| App del repartidor | Nativa (React Native) | **Web responsive** | Sin store, actualización instantánea. ADR-001 evaluó PWA (con service worker) pero hoy no está implementado |
| Geocodificación | Google Maps API | **Nominatim + fallbacks** | Gratuito, ~80% acierto, suficiente para el MVP (ADR-002) |
| Kilometraje | Input numérico rígido | **Texto con coma/punto** | Los teclados móviles españoles usan coma; 3 decimales (ADR-003) |
| Costes | — | **Por tipo de combustible** | El supervisor asigna el tipo de combustible a cada repartidor (diésel, gasolina, híbrido, eléctrico); el coste se calcula con el precio de ese tipo (ADR-004) |
| Infraestructura | VPS, Docker | **Render + GitHub Pages** | Bajo mantenimiento, free tier (ADR-005) |

---

## 📊 Estado

| Funcionalidad | Estado |
|--------------|:------:|
| Optimización de rutas (2-opt) | ✅ |
| OCR de albaranes (dirección + bultos) | ✅ |
| App web del repartidor (móvil) | ✅ |
| Torre de control (oficina) | ✅ |
| Firma digital del cliente (POD en PDF) | ✅ |
| Gestión de bultos (precarga + verificación) | ✅ |
| Incidencias con fotos | ✅ |
| Jornadas del repartidor | ✅ |
| Entrada de km con coma/punto (3 decimales) | ✅ |
| Historial de entregas | ✅ |
| API REST + RBAC (office/driver) | ✅ |
| 46 tests (43 server + 3 client) | ✅ |
| CI/CD (GitHub Actions) | ✅ |
| Replanificación dinámica con IA | 🚧 |
| Analítica avanzada | 🚧 |

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| `docs/adr/` | Architecture Decision Records (incluye el blindaje de la demo) |
| `docs/technical/` | Arquitectura, API, backend, despliegue, panel, app |
| `DECISIONS.md` | Decisiones técnicas resumidas |
| `docs/HISTORY.md` | Evolución del proyecto por fases |

---

## 🚀 Cómo ejecutar

```bash
# Backend
cd server
npm install
npm test        # 48 tests

# App del repartidor (web)
cd client
npm install
npm run dev

# Torre de control
cd client-admin
npm install
npm run dev
```

---

## 🧪 Demo viva (datos simulados)

RouteAI incluye una **demo de empresa ficticia** para portfolio: 90 días de historia con 6 repartidores, 12.000+ paradas, firmas digitales, PODs y km reales de jornada.

### Qué es real y qué es simulado

| Dato | Origen |
|---|---|
| Repartidores, paradas, firmas, incidencias, km | Generados por `server/seed-historico.js` (90 días, semilla determinista) |
| Fotografías de incidencias | Placeholders generados por script (`server/scripts/generar-fotos-incidencias.py`) |
| Rutas de cada día | Generadas cada madrugada por `server/simulate-daily.js` (cron 06:00) |

### Blindaje: los datos demo son inmutables

- Los 6 repartidores del histórico están marcados `is_demo=true`: **no pueden iniciar sesión** en la app (403), no se pueden editar ni borrar desde la Torre de Control, y sus paradas tampoco.
- El botón "borrar todo" solo elimina paradas de visitante, el histórico queda intacto.
- **Cualquier cosa que cree un visitante** (repartidores, albaranes, paradas) lleva `session_id` y caduca a las 24h. Un cron diario (03:00) las limpia en silencio.

### Crons (Hermes, no_agent, silenciosos)

| Cron | Horario | Función |
|---|---|---|
| Simulación diaria | 06:00 | Cierra jornadas de ayer, abre las de hoy, genera rutas del día |
| Limpieza expirados | 03:00 | Borra datos de visitante caducados (24h) |
| Ping antiduerme | Cada 10 min | Mantiene la API de Render despierta |

---

## 🌐 Demo

- **Landing portfolio**: https://www.kavanasystems.com/routeai/
- **App del repartidor**: https://routeai.kavanasystems.com/app/
- **Torre de control**: https://routeai.kavanasystems.com/
- **PIN oficina**: `0000`
- **PIN repartidor demo**: `5855` (solo lectura, no inicia sesión; crea un repartidor propio desde la Torre de Control para probar la app)

---

## 📄 Licencia

MIT © 2026 [Jorge Adán Rodríguez](https://www.kavanasystems.com) · Kavana Systems
