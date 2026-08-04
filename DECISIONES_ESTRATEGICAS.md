# Decisiones Estratégicas - Kavana RouteFleet

## 2026-07-13: Profesionalización para Consultoría IT
- Producto reorientado a empresas de reparto en general (sin sesgo de sector concreto).
- Marca unificada: KAVANA Logistics -> KAVANA ROUTEFLEET en todo el repositorio.
- Backend reconstruido con TDD: servicios OCR, IA (con fallback), PDF/POD y capa de datos.
- POD cerrado de extremo a extremo (firma + geo -> PDF descargable).
- Calidad: 21 tests backend + 2 frontend, CI activa en GitHub Actions.
- Bug crítico corregido: ruta de import de db.js en api.js impedía arrancar el servidor.

## 2026-04-29: Optimización Operativa y Rediseño Táctico
- Estilos inline en React para evitar fallos de compilación de Tailwind en CI.
- iframe con filtros CSS invertidos para Modo Oscuro de Google Maps sin pagar la API.
- Modelo de costes OPEX en tiempo real (€/km + €/hora del operario).
- Algoritmo greedy local como plan B si la IA de ruta (DeepSeek) falla.
