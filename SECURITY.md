# Seguridad — KAVANA Route AI

- **JWT** para autenticación de repartidores (PIN) y oficinas (PIN de empresa)
- **Autorización por ownership**: cada repartidor autenticado solo puede ver/modificar sus propias paradas (middleware `requireDriverOwnsStop`). Se aplica a PATCH/DELETE `/stops/:id`, `POST /stops/:id/incident`, `GET /stops/:id/pod` y a los estáticos `/pods/*` e `/incidents/*`
- **Borrado masivo** (`DELETE /stops`): solo rol office
- **Optimización de rutas** (`POST /optimize`): un driver solo optimiza sus paradas (validación contra la BD por id)
- **JWT enforcement**: endpoints críticos (`/optimize`, `/ocr`, `/pods`, `/incidents`) requieren autenticación; el `driver_id` en `/stops/bulk` se toma del JWT, no del body; los tokens requieren `exp` y se rechazan sin ella
- **Firmas digitales (POD):** capturadas con Canvas nativo en el cliente, embebidas en PNG, sin almacenarse en servicios externos
- **OCR:** Tesseract.js + pdftotext en el servidor (con fallback local); archivos subidos con límite de 10MB (`multer.limits.fileSize`) y nombre temporal aleatorio (sin usar el nombre original del cliente en rutas del FS)
- **API:** CORS configurado con lista fija, HTTPS forzado (Fly.io + GitHub Pages), `trust proxy` para derivar la IP real del cliente en rate limiting
- **Sin secrets en el repositorio** — auditoría 2026-08-17: `JWT_SECRET` y `OFFICE_PIN` se rotaron y viven como secrets de Fly.io (y Render mientras esté el servicio). Detección automática de secretos en CI (gitleaks)
- **Rate limiting**: logins de oficina y repartidor protegidos con límite de 10 intentos/min en producción (50 en dev); asistente técnico 25 preguntas/día por IP
- **Fail-fast en producción**: la API no arranca sin `JWT_SECRET` real ni con `OFFICE_PIN` por defecto (`0000`)
- **PINs de drivers hasheados (scrypt)**: desde 2026-08-23 los PINs se guardan como `scrypt$salt$hash` en ambos adapters; backfill automático al arrancar convierte los legacy planos; login acepta ambas formas durante la transición
- **Fallback JSON desactivado en producción**: si PostgreSQL falla, la API hace fail-fast (exit 1); el JSON store requiere `STORAGE_MODE=json` explícito en desarrollo
- **Límites de entrada**: `/stops/bulk` máx 100 direcciones por request; fotos base64 máx 5 MB decodificados
- **TLS a PostgreSQL verificado**: desde 2026-08-24 el cliente `pg` valida el certificado del servidor (`rejectUnauthorized: true` por defecto); cifrar no es autenticar. Escape explícito con `PGSSL_INSECURE=1` (solo para CAs propias no confiables) y `PGSSLMODE=disable` para tests locales
- **Backups y DR**: pg_dump diario a las 02:30 UTC con verificación anti-dump-vacío, retención 14 días, restore probado 2026-08-24 — plan completo en `docs/dr-plan.md`
- **Limitaciones honestas del MVP:** JWT en localStorage (SPA cross-origin, sin BFF); sin 2FA ni rotación de tokens; documentado como simplificaciones deliberadas para la fase actual del producto