# Métricas — KAVANA Route AI

| Métrica | Valor |
|---------|-------|
| **Archivos de código** | ~45 |
| **Líneas de código** | ~8.500 |
| **Tests** | 94 (91 server + 3 client) | JWT, autorización/ownership, API REST, OCR, POD (PDF), optimización de rutas 2-opt, migraciones SQL, fail-fast de BD, panel de administración |
| **Commits** | +70 |
| **Lenguajes** | JavaScript, JSX, CSS, SQL, YAML |

## Stack
| Capa | Tecnología |
|------|-----------|
| App repartidor | React web + Vite (web responsive, decisión ADR-001) |
| Panel oficina | React + Vite |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL (Neon) con migraciones versionadas |
| Auth | JWT (HS256, secret por entorno) |
| OCR | Tesseract.js + poppler-utils |
| Firma | Canvas nativo |
| Optimización rutas | 2-opt determinista (ADR-006, antes 001-reemplazo-ia-por-2opt) |
| Despliegue | Fly.io (backend) + GitHub Pages (frontends) |