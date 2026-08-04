# 🛡️ KAVANA ROUTEFLEET | Sistema de Logística de Campo

**KAVANA** (Propósito/Intención) es la división logística de Kavana Systems diseñada para empresas de reparto y distribución. Un sistema de gestión de campo táctico que prioriza la eficiencia, el control de costes y la trazabilidad ISO 9001.

## 🚀 Innovaciones Clave
- **Identidad Electric Orange:** Interfaz mimetizada en `#FF3D00` para máxima visibilidad en tablets industriales y móviles.
- **Arquitectura Ubicua:** Torre de Control (Desktop) + App de Operario (Mobile) sincronizadas vía red local.
- **IA Routing Engine:** Optimización de rutas mediante **DeepSeek v3** vía OpenRouter, con **fallback greedy local** si la API cae (el reparto nunca se detiene).
- **Kavana Lens:** Motor OCR de albaranes con limpieza semántica de direcciones (filtra símbolos de tabla y términos de envío).
- **Prueba de Entrega (POD) digital:** firma del receptor + geolocalización generadas en PDF descargable desde el móvil y la Torre de Control.

## 🛠️ Stack Tecnológico
- **Frontend:** React 18 + Vite (estilos inline para estabilidad visual), Vitest + Testing Library (tests).
- **Backend:** Node.js + Express, SQLite (better-sqlite3), PDFKit (POD).
- **Calidad:** 21 tests de backend (node:test, integración incluida) + 2 tests de frontend (Vitest). CI en GitHub Actions corre ambos + build.
- **Iconografía:** Lucide-React. **Animaciones:** Framer Motion.

## 📱 Acceso Multi-dispositivo
1. Arranca el backend (`server/`): `npm install && npm start` (puerto 5001).
2. Sirve el cliente (`client/`): `npm run build` y sirve `dist/`, o `npm run dev`.
3. En móvil/tablet en la misma red, accede vía la IP del PC (la `API_BASE` se resuelve automáticamente).

## 🧪 Tests y CI
```bash
# Backend
cd server && npm install && npm test
# Frontend
cd client && npm install && npm test
```
La CI (` .github/workflows/ci.yml`) ejecuta backend (tests), frontend (tests) y build en cada push a `main`.

## 📦 Estructura
- `/client`: App React (operario móvil + Torre de Control desktop).
- `/server`: API REST, BD SQLite, servicios OCR/IA/PDF y 21 tests.
- `/docs`: fichas técnicas y manuales.

---
*KAVANA ROUTEFLEET: Eficiencia en Movimiento.*
