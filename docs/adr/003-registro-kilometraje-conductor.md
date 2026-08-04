# ADR-003: Registro de kilometraje real por conductor

**Estado:** ✅ Implementado  
**Fecha:** Julio 2026  
**Contexto:** El OPEX (coste operativo) del dashboard usaba una estimación fija de
  8km por parada, sin datos reales.

---

## Contexto

El dashboard de la Torre de Control mostraba un campo "OPEX est." calculado como:
```
entregas × 0,30€/km × 8km + entregas × 15€/h × 0,5h
```

Esto no reflejaba la realidad de la ruta.

## Problema

- Sin datos reales de kilometraje, el OPEX es un número decorativo
- No hay trazabilidad de cuánto ha recorrido cada conductor
- No se puede calcular coste real por ruta ni por jornada

## Decisión

Implementar **sesiones de conductor con registro obligatorio de kilometraje**:

1. Al hacer login con PIN → pantalla obligatoria de **km iniciales**
2. Durante la jornada → el header muestra el km de inicio
3. Al cerrar jornada → pantalla obligatoria de **km finales**
4. Muestra resumen: inicial, final, **total recorrido**
5. Los datos se guardan en `driver_sessions` y se muestran en la Torre de Control

## Alternativas evaluadas

| Alternativa | Pro | Contra |
|-------------|-----|--------|
| **Km manual inicio/fin** | Simple, datos reales, sin GPS | Fricción para el conductor |
| GPS continuo | Datos automáticos, precisos | Batería, privacidad, complejidad |
| Distancia por coordenadas | Automático | No refleja ruta real (desvíos) |
| Estimación fija (lo anterior) | Sin fricción | Datos falsos |

Se eligió km manual por ser la opción más **fiable y simple** para un MVP.
El conductor ya tiene que hacer login/logout, añadir dos números no es fricción
significativa. El GPS continuo se deja para una fase posterior.

## Consecuencias

**Positivas:**
- OPEX real con datos verificables
- Histórico de km por conductor y jornada
- El conductor ve su propio kilometraje al cerrar jornada

**Negativas:**
- Depende de que el conductor introduzca los datos correctamente
- Se puede equivocar al escribir los números
- No detecta desvíos de ruta ni km no relacionados con el reparto

## Dónde está

- `server/src/db.js` — tabla `driver_sessions` + queries
- `server/src/routes/api.js` — endpoints `/driver/session/*`
- `client/src/App.jsx` — pantallas de km inicial/final
- `client-admin/src/App.jsx` — sección "Jornadas" en panel
