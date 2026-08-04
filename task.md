# Registro de Tareas - Kavana RouteFleet

## ✅ Completado (Sesión 2026-07-13 — Profesionalización)
- [x] Unificar marca KAVANA Logistics -> KAVANA ROUTEFLEET en docs, UI y config.
- [x] Reorientar el producto a empresas de reparto en general (sin sesgo de sector).
- [x] Backend reconstruido y funcional: db.js, ocrService, aiService, pdfService, api.js como factory con inyección de BD.
- [x] POD 100% cerrado: firma + geolocalización -> PDF descargable desde móvil y Torre de Control.
- [x] Fallback de rutas (OpenRouter caído -> algoritmo greedy local).
- [x] 21 tests de backend (node:test, incluye integración end-to-end POD).
- [x] 2 tests de frontend (Vitest + Testing Library) sobre App.
- [x] CI en GitHub Actions: backend tests + frontend tests + build en cada push.
- [x] Corregir ruta rota de import de db.js en api.js (bug crítico que impedía arrancar).

## 🔧 Deuda técnica honesta (pendiente, no bloqueante)
- [ ] Multi-tenant: SQLite es mono-tenant (una empresa por instancia).
- [ ] Cobertura de tests del cliente aún parcial (solo renderizado de App).
- [ ] `deploy.yml` despliega el cliente a GitHub Pages pero no el backend (requiere VPS o PaaS).
