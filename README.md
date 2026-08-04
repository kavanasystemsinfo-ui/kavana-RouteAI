# 🛡️ KAVANA LOGISTICS | Industrial Control System

**KAVANA** (Propósito/Intención) es la división logística de Kavana Systems diseñada para empresas de reparto y distribución. Un sistema de gestión de campo táctico que prioriza la eficiencia, el control de costes y la trazabilidad ISO 9001.

## 🚀 Innovaciones Clave
- **Identidad Electric Orange:** Interfaz mimetizada en `#FF3D00` para máxima visibilidad en tablets industriales y móviles.
- **Arquitectura Ubicua:** Torre de Control (Desktop) + App de Operario (Mobile) sincronizadas vía red local (Zero-Cloud).
- **IA Routing Engine:** Optimización semántica de direcciones mediante **DeepSeek v3** vía OpenRouter.
- **Kavana Lens:** Motor OCR especializado en albaranes industriales con filtrado inteligente de materiales.

## 🛠️ Stack Tecnológico
- **Frontend:** React 18 + Vite (Estilos Inline para estabilidad visual absoluta).
- **Backend:** Node.js + Express.
- **Base de Datos:** SQLite3 (Local & Fast).
- **Iconografía:** Lucide-React.
- **Animaciones:** Framer Motion.

## 📱 Acceso Multi-dispositivo (Smart Network)
El sistema es dinámico y no depende de servidores externos para la red local.
1. Inicia el sistema en el PC principal.
2. Abre el navegador en cualquier móvil/tablet en la misma WiFi.
3. Accede vía IP local (ej: `http://192.168.0.159:3001`).
4. *El sistema resuelve automáticamente la API_BASE para sincronizar datos en tiempo real.*

## 📦 Estructura del Proyecto
- `/client`: Aplicación React (Frontend táctico).
- `/server`: API REST, Base de Datos y Motor OCR (Backend).
- `/docs`: Fichas técnicas y manuales de usuario.

---
*KAVANA LOGISTICS: Eficiencia Industrial en Movimiento.*
