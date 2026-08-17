# ADR-001: PWA como frontend del repartidor vs Web Responsive

**Estado:** Aceptado (confirmado 2026-08-17)
**Fecha:** 2026-07-15
**Decisor:** Jorge Adán Rodríguez

## Contexto
El repartidor necesita una aplicación móvil para escanear albaranes, capturar
firma del cliente y registrar geolocalización. El contexto original evaluaba
que debía funcionar sin conexión (túneles, sótanos).

## Alternativas Evaluadas
| Alternativa | Pros | Contras |
|------------|------|---------|
| **App nativa (React Native)** | Acceso total a hardware, mejor rendimiento | Publicación en stores, actualizaciones lentas, coste |
| **PWA** | Sin store, actualización instantánea, offline vía SW | Limitaciones de hardware (notificaciones, NFC), complejidad del SW |
| **Web responsive** | Simple, barato, sin mantenimiento de SW | Sin offline real |

## Decisión
**Web responsive pensada para móvil** (sin app nativa ni PWA con service
worker). Canvas nativo para firma digital.

**Confirmación 2026-08-17 (auditoría y análisis de negocio):** la app del
repartidor trabaja SIEMPRE con conexión de datos móviles: recibe la ruta del
día desde la Torre de Control y envía cada entrega/pod/incidencia en tiempo
real. Sin cobertura no tiene rutas que ejecutar ni entregas que registrar, así
que el offline del service worker no aporta valor real al flujo de negocio.
La complejidad del SW (cacheo, versionado, gestión de actualizaciones) se
descartó deliberadamente: más superficie de fallo para un beneficio nulo en
este modelo.

## Consecuencias
- Positivas: sin store, actualización instantánea, accesible desde cualquier
  navegador, sin coste de mantenimiento de service worker
- Negativas: sin offline real (no necesario en el flujo real), sin
  notificaciones push nativas, limitado en iOS

## Nota técnica (2026-08-17)
El `index.html` tenía un script que borraba TODAS las caches del navegador en
cada carga (`caches.keys().then(keys => keys.forEach(k => caches.delete(k)))`).
Ese script se retiró: era antagónico con cualquier cacheo futuro y forzaba la
descarga de assets reutilizables en cada visita. Vite gestiona el cacheo de
assets con hashes de contenido (`assets/index-<hash>.js`), que es el mecanismo
correcto para una SPA servida por GitHub Pages.