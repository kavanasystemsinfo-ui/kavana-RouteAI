# ADR-001: PWA como frontend del repartidor vs App Nativa

**Estado:** Aceptado
**Fecha:** 2026-07-15
**Decisor:** Jorge Adán Rodríguez

## Contexto
El repartidor necesita una aplicación móvil para escanear albaranes, capturar firma del cliente y registrar geolocalización. Debe funcionar sin conexión (túneles, sótanos).

## Alternativas Evaluadas
| Alternativa | Pros | Contras |
|------------|------|---------|
| **App nativa (React Native)** | Acceso total a hardware, mejor rendimiento | Publicación en stores, actualizaciones lentas, coste |
| **PWA** | Sin store, actualización instantánea, offline vía SW | Limitaciones de hardware (notificaciones, NFC) |
| **Web responsive** | Simple, barato | No funciona offline, peor UX móvil |

## Decisión
**Web responsive pensada para móvil** (sin app nativa). El ADR evaluó PWA con
Service Worker para offline, pero a fecha de hoy **no hay service worker ni
manifest** en el código: el client es una SPA web que funciona con conexión.
Canvas nativo para firma digital.

## Consecuencias
- Positivas: sin store, actualización instantánea, accesible desde cualquier navegador
- Negativas: sin offline real (pendiente implementar service worker), sin notificaciones push nativas, limitado en iOS

---

# ADR-002: Almacenamiento JSON vs PostgreSQL

**Estado:** Aceptado

## Contexto
RuteFleet maneja albaranes, firmas y rutas. No requiere consultas complejas ni relaciones múltiples.

## Decisión
**Almacenamiento en JSON + sistema de archivos.** Las firmas se guardan como PNG embebidas en los albaranes. Suficiente para el volumen actual, sin depender de una BD externa.

## Alternativa descartada
PostgreSQL: over-engineering para el dominio. Si escala, se migra.
