# ADR-002: Geocodificación con Nominatim y fallbacks

**Estado:** ✅ Implementado  
**Fecha:** Julio 2026  
**Contexto:** El algoritmo 2-opt (ADR-001) necesita coordenadas lat/lng para funcionar.  
  También se usan para generar URLs de Google Maps y registrar ubicación de PODs.

---

## Contexto

Para geocodificar direcciones españolas se necesita un servicio que convierta
"Calle Bordadores, 10, Valencia" en coordenadas (39.475, -0.376).

Opciones disponibles: Google Maps API (pago), Mapbox (pago), Nominatim (gratuito).

## Problema

- El MVP no justifica un coste recurrente de API de geocodificación
- Las direcciones de albaranes tienen formato complejo:
  `"Calle X, N - CP Ciudad (Zona)"`
- Calles con el mismo nombre existen en múltiples ciudades españolas
- Sin validación geográfica, Nominatim devuelve coordenadas de otras ciudades

## Decisión

Usar **Nominatim** (OpenStreetMap) con:

1. **Múltiples formatos de query** por dirección (hasta 8 variantes)
2. **Validación de bounding box** (Valencia: 39.35-39.60, -0.45 - -0.30)
3. **Caché en memoria** para no repetir peticiones

## Alternativas evaluadas

| Alternativa | Pro | Contra |
|-------------|-----|--------|
| Google Geocoding API | Precisión ~99% | ~5€/1000 peticiones |
| Mapbox | Precisión similar a Google | ~0,50€/1000, requiere registro |
| **Nominatim + fallbacks** | **Gratis, 0€** | ~80% acierto en Valencia |

## Consecuencias

**Positivas:**
- Sin coste operativo
- Sin API key, sin registro
- El bounding box filtra resultados de otras ciudades
- Los fallbacks recuperan direcciones que el query simple no encuentra

**Negativas:**
- ~20% de direcciones no se geocodifican (calles pequeñas no indexadas)
- Si la precisión no es suficiente en producción, migrar a Google Maps API

## Dónde está

- `server/src/services/geocode.js` — lógica completa con fallbacks
