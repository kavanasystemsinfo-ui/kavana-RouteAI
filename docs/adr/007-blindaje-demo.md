# ADR-007: Blindaje de la demo (datos históricos inmutables + datos de visitante 24h)

**Estado:** ✅ Implementado  
**Fecha:** Agosto 2026  
**Contexto:** La demo de portfolio de RouteAI necesita parecer una empresa viva con 90 días de historia, pero sin que un visitante pueda destrozarla al probar la app.

---

## Contexto

RouteAI se muestra a reclutadores como demo de portfolio. Para que parezca real, se generó un histórico de 90 días (`seed-historico.js`): 6 repartidores, 12.000+ paradas, firmas digitales, PODs, incidencias con foto y km de jornadas.

El problema: si la demo está abierta a cualquiera (PIN de oficina público `0000`), un visitante podría:
- Entrar en la app con el PIN de un repartidor del histórico y entregar/borrar sus paradas
- Borrar paradas o desactivar repartidores desde la Torre de Control
- Contaminar la demo con datos de prueba que se acumulan para siempre

## Problema

- Los datos del histórico deben ser **inmutables** (solo lectura): ni editarlos, ni borrarlos, ni acceder con sus PIN.
- Un visitante debe poder **probar la app de verdad**: crear sus propios repartidores, albaranes y paradas.
- Los datos de prueba del visitante deben **desaparecer solos** (caducidad 24h), sin que nadie los borre a mano.

## Decisión

### 1. Datos demo marcados como `is_demo`

- Nuevas columnas en `drivers`: `is_demo BOOLEAN DEFAULT false`, `session_id TEXT`, `expira_en TIMESTAMP`.
- Nuevas columnas en `stops`: `session_id TEXT`, `expira_en TIMESTAMP`.
- El seed histórico marca sus 6 repartidores con `is_demo=true`.

### 2. Bloqueos de escritura (backend, 403)

| Operación | Comportamiento |
|---|---|
| `POST /drivers/login` con PIN demo | 403 "acceso restringido" |
| `PATCH /drivers/:id` sobre repartidor demo | 403 "solo lectura" |
| `PATCH /stops/:id` sobre parada demo | 403 "solo lectura" |
| `DELETE /stops/:id` sobre parada demo | 403 "solo lectura" |
| `POST /stops/:id/incident` sobre parada demo | 403 "solo lectura" |
| `DELETE /stops` (borrar todo) | Borra solo paradas de visitante, el histórico queda intacto |

Una parada es demo si pertenece a un repartidor `is_demo`.

### 3. Datos de visitante con caducidad 24h

- La Torre de Control genera un `session_id` por navegador (localStorage) y lo envía al crear repartidores.
- El backend asigna `expira_en = now + 24h` a todo lo que crea un visitante.
- `cleanupExpired()` borra drivers caducados y sus paradas/incidencias/pods/sesiones.
- Endpoint `POST /api/cleanup-expired` + cron diario a las 03:00 (script Python no_agent, silencioso).

### 4. Frontend honesto

- Repartidores demo: etiqueta "demo · solo lectura" + 🔒, sin selector de combustible ni botón desactivar.
- Paradas demo: 🔒 en vez de la papelera.

## Alternativas evaluadas

- **Aislar por `session_id` también el histórico** (cada visitante ve su copia): descartado, la BD tendría 12.000 paradas × N visitantes. El histórico es compartido y de solo lectura.
- **No proteger nada** (confiar en que nadie toca): descartado, una demo abierta siempre se contamina.
- **Borrar a mano cuando se ensucie**: descartado, requiere intervención manual y se puede olvidar.

## Tradeoffs

- Los repartidores demo no pueden probar la app con sus PIN: el visitante debe crear uno propio (2 clics en la Torre de Control). Es el precio de la inmutabilidad.
- El cron de limpieza depende de que Hermes esté activo. Es no_agent y silencioso: cero coste de tokens, solo avisa si falla.
- `esStopDemo` hace 2 queries (stops + drivers) por operación protegida: coste despreciable a esta escala.

## Dónde está

- `server/src/db.js` — columnas, `cleanupExpired` (adaptadores PG y JSON)
- `server/src/routes/api.js` — bloqueos 403, endpoint `/api/cleanup-expired`
- `server/src/seed.js` y `server/seed-historico.js` — marcar repartidores demo
- `client-admin/src/App.jsx` — `getSessionId()`, etiquetas, candados
- `~/.hermes/scripts/routeai-cleanup-expired.py` — cron de limpieza

## Verificación

- 48/48 tests (4 nuevos: login demo 403, PATCH driver demo 403, PATCH/DELETE parada demo 403, cleanup expirados)
- Verificado en producción: login 5855 → 403, PATCH driver → 403, DELETE parada demo → 403, paradas con `is_demo` correcto, cleanup responde sin tocar la demo.
