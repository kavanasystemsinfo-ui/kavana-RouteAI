# Decisiones Estratégicas - Kavana Logistics

## 2026-04-29: Optimización Operativa y Rediseño Táctico

### 1. Motor de Inteligencia Artificial (DeepSeek v3)
**Decisión:** Se ha integrado DeepSeek v3 a través de OpenRouter para la optimización de rutas en lugar de algoritmos matemáticos tradicionales o la API de Google Maps Routes.
**Razón:** El coste es virtualmente cero ($0.14/1M tokens) y la IA posee "conocimiento semántico" de la geografía española, eliminando la necesidad de geocodificación lat/lng para una primera fase.

### 2. UI con Estilos Inline (Rescate Visual)
**Decisión:** Se ha migrado el diseño de componentes críticos de clases externas a estilos inline en React.
**Razón:** Se detectaron problemas de compilación con Tailwind CSS en el entorno local. Los estilos inline garantizan que la estética "Premium Tactical" se mantenga idéntica al mockup sin dependencias externas.

### 3. OCR con Filtrado Lógico (Anti-Espagueti)
**Decisión:** Se ha implementado un motor de post-procesamiento OCR que limpia símbolos de tablas (| , [ , ]) y filtra palabras clave industriales (Puntales, Largueros).
**Razón:** Tesseract local tiene limitaciones con tablas físicas. La lógica de negocio aplicada asegura que el repartidor reciba una dirección limpia para el GPS al 95%.

### 4. Mapa en Vivo "Zero-Cost"
**Decisión:** Uso de un Iframe de Google Maps con filtros CSS (Invert/Hue-rotate) para simular un "Dark Mode" profesional.
**Razón:** Permite tener un mapa real e interactivo sin configurar una tarjeta de crédito en Google Cloud ni pagar por la API de JavaScript.

## 2026-05-01: Unificación de Marca y Conectividad Ubicua

### 5. Identidad Visual "Electric Orange" (#FF3D00)
**Decisión:** Migración global de la paleta de colores del naranja estándar al Naranja Eléctrico de alta intensidad.
**Razón:** Eliminar la discrepancia visual entre el logotipo corporativo y la interfaz del Dashboard. El tono #FF3D00 proporciona el contraste necesario para entornos industriales con mucha luz y refuerza el posicionamiento "Premium" de Kavana Systems.

### 6. Enrutamiento Dinámico de Red (Multi-device)
**Decisión:** Sustitución de `localhost` por `window.location.hostname` en todas las llamadas a la API del frontend.
**Razón:** Habilitar el uso de la App en tablets y móviles de operarios sin necesidad de deploys en la nube. El sistema ahora detecta automáticamente la IP del servidor en la red local, permitiendo una "Torre de Control" centralizada y múltiples clientes de campo sincronizados.

### 7. Modelo de Costes OPEX Real-Time
**Decisión:** Implementación de un cálculo financiero dinámico basado en Sueldo Operario/Hora + Desgaste Vehículo/Km.
**Razón:** Sustituir la métrica estática de "coste por parada" por una visión financiera real que permita al supervisor ver el impacto del tráfico y la eficiencia del operario en el margen de beneficio de cada entrega.
