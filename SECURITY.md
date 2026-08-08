# Seguridad — KAVANA Route AI

- **JWT** para autenticación de repartidores (PIN) y oficinas (PIN de empresa)
- **Autorización por ownership**: cada repartidor autenticado solo puede ver/modificar sus propias paradas (middleware `requireDriverOwnsStop`)
- **JWT enforcement**: endpoints críticos (`/optimize`, `/ocr`, `/pods`, `/incidents`) requieren autenticación; el `driver_id` en `/stops/bulk` se toma del JWT, no del body
- **Firmas digitales (POD):** capturadas con Canvas nativo en el cliente, embebidas en PNG, sin almacenarse en servicios externos
- **OCR:** Tesseract.js + pdftotext en el servidor (con fallback local); archivos subidos con límite de 10MB (`multer.limits.fileSize`)
- **API:** CORS configurado, HTTPS forzado (Render + GitHub Pages)
- **Sin secrets** en el repositorio (las claves viven en variables de entorno)
- **Limitaciones conocidas del MVP:** PINs sin hash, sin rate limiting de login, JWT en localStorage; documentado como simplificación deliberada del MVP
