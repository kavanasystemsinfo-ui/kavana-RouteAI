# KAVANA ROUTE AI

> **Plataforma SaaS de optimización inteligente de rutas de reparto mediante IA, diseñada para reducir costes operativos, mejorar la productividad de los conductores y ofrecer visibilidad completa de las operaciones de última milla.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![Express](https://img.shields.io/badge/Express-API-lightgrey)
![PWA](https://img.shields.io/badge/PWA-Offline-blueviolet)
![AI](https://img.shields.io/badge/AI-Route%20Optimization-8A2BE2)
![Tests](https://img.shields.io/badge/Tests-40-success)
![License](https://img.shields.io/badge/License-MIT-success)

---

# Visión General

**KAVANA Route AI** es una plataforma SaaS para la gestión inteligente de operaciones de reparto de última milla.

Su objetivo principal es ayudar a las empresas a optimizar sus rutas mediante algoritmos de planificación y asistencia basada en IA, reduciendo kilómetros recorridos, tiempos de entrega y costes operativos.

La plataforma combina planificación inteligente, seguimiento operativo y captura digital de evidencias de entrega desde una única solución.

Forma parte del ecosistema **Kavana Systems**, orientado al desarrollo de software empresarial moderno.

---

# Problema

Las empresas de distribución afrontan diariamente desafíos que afectan directamente a su rentabilidad:

- Rutas poco eficientes.
- Kilómetros innecesarios.
- Consumo elevado de combustible.
- Baja productividad de los conductores.
- Escasa visibilidad sobre el estado de las entregas.
- Procesos administrativos manuales.
- Dificultad para localizar evidencias de entrega.

La ausencia de herramientas inteligentes provoca mayores costes operativos y una planificación menos eficiente.

---

# Solución

KAVANA Route AI digitaliza el ciclo completo de reparto combinando inteligencia artificial y herramientas operativas.

La plataforma proporciona:

- Optimización inteligente de rutas.
- Asistencia al conductor durante la jornada.
- Dashboard para supervisión en tiempo real.
- Captura digital de entregas (POD).
- Firma electrónica del cliente.
- OCR de documentación.
- Geolocalización de entregas.
- Funcionamiento Offline-First.
- API REST para integraciones.

---

# Arquitectura

```
             IA

              │

      Motor de Optimización

              │

────────────────────────────────────

 Conductores             Supervisores

       │                      │

 Progressive Web App     Torre de Control

        ╲                  ╱

        REST API (Express)

               │

JWT Authentication + Business Logic

               │

OCR · POD · Geolocalización

               │

 Persistencia de Datos
```

La plataforma separa completamente la operación en movilidad del panel de supervisión, compartiendo una única API responsable de la autenticación, la lógica de negocio y la sincronización de toda la información.

---

# Stack Tecnológico

### Frontend

- React
- Vite
- TypeScript
- Progressive Web App (PWA)

### Backend

- Node.js
- Express

### Inteligencia Artificial (asistencia)

- Preparado para integración con modelos LLM (consultas, incidencias)
- OCR mediante Tesseract.js + pdftotext

### Algoritmos

- Optimización de rutas: 2-opt (local, determinista)
- Planificación de reparto: greedy + 2-opt

### Automatización

- OCR mediante Tesseract.js
- Captura de firma digital
- Geolocalización

### Infraestructura

- Render
- GitHub Pages

### Seguridad

- JWT Authentication
- Role Based Access Control (RBAC)

---

# Funcionalidades

### Optimización Inteligente

- Optimización automática de rutas.
- Asistencia al conductor.
- Reducción de kilómetros recorridos.
- Mejora de la planificación diaria.

### Operación

- Gestión de repartidores.
- Dashboard operativo.
- Estado de entregas en tiempo real.
- Histórico completo.

### Evidencias

- Firma digital (POD).
- OCR de albaranes.
- Geolocalización.
- Registro de incidencias.

### Plataforma

- Progressive Web App.
- API REST.
- Arquitectura desacoplada.
- Operación Offline-First.

---

# Decisiones de Ingeniería

Ver [`DECISIONS.md`](./DECISIONS.md) para el registro completo de decisiones técnicas, cambios y su fundamento.

Resumen de decisiones clave:

| Decisión | Solución adoptada | Motivo |
|----------|-------------------|--------|
| Optimización de rutas | Algoritmo 2-opt local | Sin coste, instantáneo, siempre disponible. La IA no aportaba mejora significativa |
| Geocodificación | Nominatim con fallbacks + validación Valencia | Gratuito, ~80% acierto. Google Maps API sería más preciso pero no necesario para MVP |
| OCR | pdftotext + limpieza de prefijos | Extracción fiable de texto de PDFs con formato tabular |
| Aplicación móvil | Progressive Web App | Instalación inmediata y funcionamiento offline |
| Firma digital | HTML5 Canvas | Ligero y sin dependencias |
| Backend | Express | Arquitectura simple y mantenible |
| Infraestructura | Render + GitHub Pages | Bajo mantenimiento |

---

# Estado del Proyecto

| Funcionalidad | Estado |
|--------------|:------:|
| Optimización de rutas | ✅ |
| Dashboard operativo | ✅ |
| Captura POD | ✅ |
| Firma digital | ✅ |
| OCR | ✅ |
| Offline-First | ✅ |
| API REST | ✅ |
| Tests automatizados | ✅ |
| Replanificación dinámica mediante IA | 🚧 |
| Predicción de incidencias | 🚧 |
| Analítica avanzada | 🚧 |

---

# Documentación

| Documento | Descripción |
|-----------|-------------|
| `docs/adr/` | Architecture Decision Records |
| `docs/technical/` | Documentación técnica |
| `docs/HISTORY.md` | Evolución del proyecto |
| `docs/METRICS.md` | Métricas de calidad |
| `docs/SECURITY.md` | Consideraciones de seguridad |
| `DECISIONS.md` | Decisiones técnicas resumidas |

---

# Ejecución Local

```bash
# Backend
cd server
npm install
npm start

# Aplicación PWA
cd client
npm install
npm run dev

# Dashboard
cd client-admin
npm install
npm run dev
```

---

# Demo

🌐 **Landing**

https://routeai.kavanasystems.com

🚚 **Aplicación**

https://routeai.kavanasystems.com/app

**PIN demostración**

```
5855
```

---

# Roadmap

Próximas líneas de evolución:

- Replanificación dinámica basada en tráfico.
- Balanceo inteligente entre conductores.
- Predicción automática de retrasos.
- Estimación dinámica de hora de llegada (ETA).
- Integración con Google Maps y OpenStreetMap.
- Evidencia fotográfica.
- Notificaciones Push.
- Recomendaciones operativas mediante IA.
- Analítica predictiva para responsables de operaciones.

---

# Ecosistema Kavana Systems

Este proyecto forma parte del ecosistema **Kavana Systems**, una colección de aplicaciones empresariales desarrolladas siguiendo el **Kavana Engineering Standard (KES)**.

- Manufacturing (MES)
- Warehouse (WMS)
- Route AI (AI Delivery Platform)

Todos los proyectos comparten la misma filosofía de arquitectura, documentación y calidad de ingeniería.

---

# Aviso

Este proyecto forma parte de mi portfolio profesional y tiene como objetivo demostrar conocimientos de arquitectura de software, desarrollo full stack e integración de inteligencia artificial aplicada a la optimización de procesos empresariales.

No representa un producto comercial implantado en clientes reales.

---

# Autor

Desarrollado por **Jorge Adán Rodríguez**

**Founder · Kavana Systems**

Software Architect · Full Stack Developer · AI Product Engineer

🌐 https://www.kavanasystems.com
