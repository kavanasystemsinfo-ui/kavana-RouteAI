# Arquitectura — KAVANA RouteFleet

## Principio rector
El VPS (167.233.97.71) es **solo entorno de desarrollo y documentación**. Los
proyectos terminados viven fuera del VPS, igual que CleanStock:
- Backend → **Render** (servicio `routefleet-api`, Free).
- Frontends → **GitHub Pages** (sin servidor propio, HTTPS automático).

## Componentes

```
┌─────────────────────┐         ┌──────────────────────────┐
│ App Repartidor      │  HTTPS  │ Backend API (Render)     │
│ (routefleet.        │ ──────▶ │ Express + store JSON     │
│  kavanasystems.com/ │ ◀────── │ /api/* , /pods/*          │
│  app)               │         └──────────────────────────┘
└─────────────────────┘                  ▲
┌─────────────────────┐                  │
│ Panel Oficinas      │  HTTPS           │
│ Torre de Control    │ ─────────────────┘
│ (routefleet.        │
│  kavanasystems.com/ │
└─────────────────────┘
```

## Datos
- Store JSON en disco (`routefleet.json` en el server de Render). Sin SQLite
  para evitar compilación nativa en Render Free. Listo para migrar a Postgres.
- PODs: PDFs generados con pdfkit en `./pods`. En Render son efímeros tras
  spin-down; el endpoint `GET /api/stops/:id/pod` los regenera al vuelo si la
  parada tiene firma guardada.

## Identidades y autenticación (JWT)
- **Repartidor**: se identifica con un PIN (4 dígitos) que se guarda en
  `localStorage` del móvil. `POST /api/drivers/login` valida el PIN y devuelve un
  **JWT** (`role:driver`, exp 8h). Cada llamada del repartidor (crear parada,
  entregar, incidencia, borrar) envía ese JWT en `Authorization: Bearer ***.
- **Oficina**: login con PIN único de empresa (`OFFICE_PIN`, def. `0000`).
  `POST /api/office/login` devuelve un **JWT** (`role:office`). El panel lo guarda
  en `sessionStorage` y lo envía en cada fetch.
- **Firma**: HS256 con `crypto` nativo de Node (sin dependencias externas).
  Secreto en `JWT_SECRET` (env de Render). Sin token → `401`; rol incorrecto → `403`.
- MVP sin usuarios/roles múltiples (YAGNI): solo dos roles (office / driver).

## Seguridad
- Toda lectura del panel (repartos, firmas, KPIs) y toda escritura del repartidor
  exigen JWT válido. Nadie puede leer los datos de los clientes sin autenticarse.
- El POD se sirve también con `?token=` para los enlaces/iFrame del panel (GET).
- `JWT_SECRET` debe configurarse en Render con un valor fuerte y aleatorio; si no
  se define, se usa un fallback de desarrollo (válido pero no para producción).

## Flujo
1. Oficina da de alta repartidores (PIN) en el panel.
2. Repartidor abre la app, introduce su PIN (se guarda en el móvil).
3. Repartidor escanea albarán → parada creada con `driver_id`.
4. Repartidor entrega → POD generado en el navegador (jsPDF) + subido al backend.
5. Oficina ve en el panel: Dashboard (KPIs), Repartos (filtros), Firmas (galería).
