# Auditoría adversarial RouteAI — Informe del orquestador

**Fecha:** 2026-08-22
**Método:** 4 subagentes adversariales en paralelo (backend/seguridad, datos/arquitectura, frontend, infra/pipeline) + verificación empírica del orquestador contra el código real.
**Alcance:** solo lectura. Sin secretos, API keys ni datos sensibles en este documento.

## Verificación del orquestador (hallazgos confirmados contra el código)

Confirmados leyendo el código real:

1. `simulate-daily.js:157` — cierra TODAS las sesiones `active` sin filtro de fecha: cierra con km inventados la jornada de un repartidor real abierta a esa hora. CONFIRMADO.
2. `simulate-daily.js:201-204` — INSERT de jornada sin guard de unicidad (solo se comprueba `yaHayParadasHoy`, que no protege sesiones): re-ejecuciones duplican jornadas activas. CONFIRMADO.
3. `db.js updateStop` — interpolación de nombres de columna desde `Object.entries(fields)` sin whitelist. CONFIRMADO (hoy los callers pasan campos fijos; es deuda crítica, no explotable hoy).
4. `deleteStop` / `cleanupExpired` — multi-write sin transacción. CONFIRMADO.
5. `/optimize` — actualiza `stop_number` de CUALQUIER parada sin pasar por `esStopDemo`: única escritura que escapa del blindaje demo. CONFIRMADO (`optimization.routes.js:56` no referencia `is_demo`).
6. Token JWT aceptado por query string (`auth.js:73`) y CORS que refleja cualquier origin con credentials. CONFIRMADO.
7. Login office compara PIN con `!==` (no timing-safe) y login driver carga TODOS los drivers a memoria. CONFIRMADO.
8. `/stops/bulk` sin cap de longitud de array. CONFIRMADO.

## Los 10 gaps más críticos (priorizados como senior architect)

Criterio: impacto real × probabilidad × coste del fix. La demo viva es carta de presentación ante reclutadores: corromperla es perder el activo.

### G1 — P0 · Cron de simulación puede corromper datos reales
`server/simulate-daily.js:157 y 201-204`. Cierra jornadas activas sin filtro de fecha (km inventados sobre sesiones reales) e inserta jornadas duplicadas bajo reintento/concurrencia.
**Fix:** cerrar solo sesiones con fecha < hoy; INSERT condicional con `NOT EXISTS` + advisory lock. Coste: ~15 líneas.

### G2 — P0 · Sin backups ni DR de ningún componente
Neon (BD completa), volumen Fly (PODs/fotos): cero `pg_dump`, cero réplica, una sola región. Si se pierde Neon o el volumen, se pierde el histórico demo entero (~12k paradas).
**Fix:** cron diario en VPS con `pg_dump` a almacenamiento externo + copia del volumen. Coste: 1 script + 1 cron.

### G3 — P1 · Fuerza bruta de PINs viable
Rate limit basado en `req.ip` con `trust proxy 1`: rotando `X-Forwarded-For` se obtienen IPs frescas. A esto se suma PIN comparado con `===` (no timing-safe) y sin validación de formato al crear drivers (PINs de 1 dígito posibles). El login office usa PIN fijo de 4 dígitos: espacio de búsqueda de 10k, trivial sin rate limit efectivo.
**Fix:** rate limit por cuenta intentada además de IP + validación 4-6 dígitos + `timingSafeEqual`.

### G4 — P1 · Escritura fuera del blindaje demo
`optimization.routes.js:56`: la oficina puede renumerar paradas de la demo "solo lectura" (rompe el histórico de 90 días que enseña Jorge).
**Fix:** aplicar el filtro is_demo antes del bucle de updates.

### G5 — P1 · Multi-write sin transacciones
`db.js deleteStop` (3 DELETE) y `cleanupExpired` (5 DELETE) dejan huérfanos si fallan a mitad → panel pintando filas rotas.
**Fix:** transacción (`BEGIN/COMMIT`) o CTE encadenada.

### G6 — P1 · Rendimiento del panel degradado con crecimiento de datos
Faltan índices para los filtros `from/to` reales (`stops.created_at`, `driver_sessions.started_at`); `/driver/sessions` hace N+1 queries y filtra en JS; listados sin paginación ni proyección (`items` JSON de 12k filas en cada refresco). Funciona hoy con la demo; degrada linealmente.
**Fix:** migración 003 con índices + JOIN único + LIMIT/proyección.

### G7 — P2 · Superficie de ataque auth residual
JWT aceptado por query string (queda en logs/historial/Referer), CORS reflect-any-origin + credentials, foto de incidencia validada por mimetype declarado (no magic bytes) → XSS stored posible en mismo origin.
**Fix:** token solo por header/cookie corta para descargas, CORS allowlist estricta, magic bytes en upload.

### G8 — P2 · Contenedor root sin health checks HTTP
Dockerfile sin `USER`, fly.toml sin checks: proceso colgado que acepta TCP no se reinicia; RCE = root.
**Fix:** `USER node` + `[http_service.checks]` contra `/health`.

### G9 — P2 · Cold start como vector de disponibilidad
`min_machines_running=0`: ráfagas despiertan la máquina (502 de 7-10 s ya observados); patrón alternado sleep/wake abusable. El ping antiduerme del VPS no está confirmado activo.
**Fix:** `min_machines_running=1` (coste trivial en shared-1x) o suspend+keep-alive fiable.

### G10 — P3 · Deuda estructural que amplifica todo lo anterior
`db.js` mezcla adapter PG + JSON + queries (el adaptador JSON tiene prototype pollution potencial vía `Object.assign`); god files App.jsx de 771/942 líneas duplicados entre client y client-admin; `error.message` del backend servido crudo al cliente; gitleaks allowlist permanente con comentario obsoleto.
**Fix:** dividir db.js en adapters, extraer hooks comunes, errores genéricos al cliente.

## Lo que está bien (verificado)

- Zero sinks XSS en frontends; logout limpia storage; sin secretos en bundles.
- OCR con mkdtemp+UUID (sin path traversal); guards fail-fast de producción para secrets; verifyToken exige exp y timing-safe.
- RBAC por ruta consistente salvo G4.

## Orden de ejecución recomendado

1. G1+G4 (protegen la demo viva, horas)
2. G2 (backups, media jornada)
3. G5+G3 (transacciones + hardening auth, medio día)
4. G6 (índices+N+1, media jornada)
5. G7-G10 (hardening progresivo)
