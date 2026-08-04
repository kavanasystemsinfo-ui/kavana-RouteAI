# ADR-001: Reemplazo de IA por algoritmo 2-opt en optimización de rutas

**Estado:** ✅ Implementado  
**Fecha:** Julio 2026  
**Contexto:** [Principio KES 1.6 — IA es herramienta, no solución universal]

---

## Contexto

La optimización de rutas de reparto se implementó inicialmente llamando a un modelo de IA
(OpenRouter, `nvidia/nemotron`) para ordenar las paradas. El flujo era:

1. Geocodificar todas las direcciones a coordenadas
2. Enviar coordenadas + direcciones a la IA
3. La IA devolvía el orden de visita
4. Si la IA fallaba, se usaba greedy como fallback

## Problema

- La IA tardaba **20-30 segundos** por llamada
- El modelo gratuito a menudo devolvía el orden original sin optimizar
- Dependencia de conexión a Internet y de un servicio externo (OpenRouter)
- Coste recurrente por llamada

## Decisión

Reemplazar la IA por el algoritmo **2-opt** local, un algoritmo determinista
clásico para el Problema del Viajante (TSP).

## Alternativas evaluadas

| Alternativa | Pro | Contra |
|-------------|-----|--------|
| Mantener IA (OpenRouter) | Conocimiento geográfico semántico | Lento, caro, impredecible |
| Solo greedy (vecino más cercano) | Simple, rápido | Rutas subóptimas (efecto miope) |
| **2-opt** | Óptimo o casi, 0€, <1ms | Necesita coordenadas |
| Google OR-Tools | Muy potente | Dependencia externa, sobreingeniería para MVP |

## Consecuencias

**Positivas:**
- Tiempo de respuesta: **<1ms** vs 30s antes
- **0€** de coste operativo
- **Siempre funciona**, sin depender de Internet ni terceros
- Resultado determinista y reproducible

**Negativas:**
- Requiere geocodificación previa (necesita coordenadas)
- Las direcciones no geocodificables quedan al final de la ruta

## Dónde está

- `server/src/services/routeOptimizer.js` — algoritmo 2-opt
- `server/src/routes/api.js` — endpoint `/api/optimize`
