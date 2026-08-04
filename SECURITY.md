# Seguridad — KAVANA Route AI

- **JWT** para autenticación de repartidores (PIN) y oficinas (PIN de empresa)
- **Firmas digitales (POD):** capturadas con Canvas nativo en el cliente, embebidas en PNG, sin almacenarse en servicios externos
- **OCR:** Tesseract.js + pdftotext en el servidor (con fallback local); las imágenes subidas no se persisten
- **API:** CORS configurado, HTTPS forzado (Render + GitHub Pages)
- **Sin secrets** en el repositorio (las claves viven en variables de entorno)
