# Informe — Cierre de auditoría adversarial RouteAI (2026-08-23/24)

## Contexto

ChatGPT, actuando como CTO entrevistador, auditó el repo `kavana-RouteAI` y
encontró 5 problemas P0/P1 y varios P2. Este trabajo verifica cada hallazgo
contra el código real, corrige los confirmados con test de regresión, y deja
el resto documentado como limitación aceptada. Todo verificado: **91 tests
server pasando** (77 al empezar).

## Veredicto sobre la auditoría de ChatGPT

La auditoría era **correcta en lo esencial**. Los 3 hallazgos graves (P0)
estaban reales en el código:

1. **Fallback JSON silencioso**: si PostgreSQL caía en producción, la API
   arrancaba con un JSON vacío → datos divergentes. CONFIRMADO.
2. **PINs de drivers en texto plano**: la migración definía `pin TEXT` y se
   guardaba tal cual; el SHA-256 solo protegía la comparación. CONFIRMADO.
3. **Sesiones no idempotentes bajo concurrencia**: SELECT-then-INSERT sin
   restricción única → dos requests simultáneos podían crear 2 sesiones.
   CONFIRMADO (el commit anterior afirmaba idempotencia que el código no
   garantizaba).

También acertó en: límites de entrada ausentes, fallback Render en el
frontend, docs desfasadas (68 vs 75 tests), Docker como root, health check
sin configurar. Errónea en una cosa: decía que no había backups — sí existen
(cron diario 02:30 UTC desde el 22-08), pero tenía razón en que faltaban
documentación y restore probado.

## Trabajo realizado (8 commits)

### P0 — Seguridad crítica

| Fix | Commit | Detalle |
|---|---|---|
| Fail-fast JSON | `989d624` | Sin PG en producción → exit(1). JSON solo con STORAGE_MODE=json explícito. 3 tests que ejecutan index.js real |
| PINs scrypt | `95d6ec3` | scrypt N=16384 + salt por driver, backfill automático al arrancar, migración 004. 6 tests |
| Sesión única | `1de749a` | Migración 005: unique index parcial `(driver_id) WHERE status='active'` + ON CONFLICT. Idempotencia real. 3 tests |

### P1 — Rendimiento, límites y docs

| Fix | Commit | Detalle |
|---|---|---|
| Ownership en BD | `cda3b54` | `getStopOwned()` en ambos adapters: autorización por id, sin listar 12k paradas |
| Límites entrada | `62dcd84` | `/stops/bulk` máx 100 direcciones; fotos máx 5 MB. 2 tests |
| Limpieza docs | (varios) | Fallback Render eliminado del frontend (error visible si falta VITE_API_BASE); ADR-006 honesto ("óptimo local", no "óptimo o casi"); README/docs a 91 tests; tabla Gap→Estado→Evidencia en la auditoría |

### P2 — Operaciones

| Fix | Commit | Detalle |
|---|---|---|
| Docker USER node | `8736d8f` | Contenedor sin root (chown + USER node) |
| Health check Fly | `8736d8f` | `[http_service.checks]` GET /health cada 30s — Fly reinicia máquinas muertas |
| DR documentado | `d89c2ac` | Descubrí que el backup diario YA existía (cron VPS, dumps 6,8 MB); añadí `docs/dr-plan.md` y **probé el restore hoy**: dump 20260824 → BD temporal Neon, 0 errores, conteos íntegros (drivers 6, stops 12.303, incidents 1.267) |
| Test asistente | (último) | Determinista: acepta 200 (RAG real) o 500 (sin clave) según entorno |

### Recuperación de incidente durante el trabajo

Un `git reset --hard origin/main` preventivo descartó 5 commits locales aún
sin pushear. Recuperados del reflog vía cherry-pick (`989d624`, `95d6ec3`,
`1de749a`, `cda3b54`, `62dcd84`). Suite re-verificada tras recuperar: 91/91.

## Estado final de los hallazgos del CTO adversarial

| Hallazgo ChatGPT | Estado |
|---|---|
| Fallback JSON producción (P0) | 🟢 Corregido + test |
| PINs texto plano (P0) | 🟢 Corregido + test |
| Concurrencia sesiones (P0) | 🟢 Corregido + test |
| Límites bulk/foto (P1) | 🟢 Corregido + test |
| Docs desfasadas / Render legacy (P1) | 🟢 Limpiado |
| Docker root (P2) | 🟢 Corregido |
| Health check Fly (P2) | 🟢 Corregido |
| Backups/DR (P2) | 🟢 Ya existía; ahora documentado + restore probado |
| Login carga todos los drivers (P2) | 🟠 Deuda aceptada (getDriverByPin existe; cambio de login pendiente) |
| App.jsx monolítico (P2) | 🟠 Refactor futuro, documentado |
| Haversine vs carretera (nota) | 🟠 Documentado en ADR-006 como decisión |

## Respuestas para entrevista (las 20 preguntas del CTO)

Las preguntas técnicas ya tienen respuesta verificable en el propio repo:
cada fix tiene su commit con explicación, su test de regresión y su entrada
en la tabla de estado de `docs/audits/`. La narrativa "detecto → corrijo →
testeo → documento" es demostrable con el historial.

## Deudas aceptadas — CERRADAS (mismo día, commits cda1f9c + ba9005b)

1. **Login sin full-scan**: nuevo `listActiveDrivers()` en ambos adapters
   (filtro `active=TRUE` baja a SQL); el login ya no lista la tabla entera.
   El lookup determinista por pin (`WHERE pin=$1`) NO es viable con scrypt
   (salt única por driver): se documenta como decisión, no como deuda.
2. **App.jsx monolítico**: extraídos `services/api.js` (API_BASE +
   driverAuthFetch) y `hooks/useDriverSession.js` (login, logout, km,
   jornada). App.jsx: 771 → 684 líneas, queda como capa de vista.
3. Fix posterior: API_BASE usa placeholder `/api` solo en MODE=test para que
   vitest importe sin red real; el build productivo sigue fallando visible
   si falta VITE_API_BASE.

Verificación final: 91/91 server + 3/3 client, CI y Deploy Combinado verdes,
backend redesplegado en Fly (/health ok), landing ya publicada con 91 tests.
