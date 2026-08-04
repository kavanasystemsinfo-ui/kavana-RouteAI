# Panel de Oficinas — Torre de Control

React (carpeta `client-admin/`). Desplegado en GitHub Pages en la rama
`gh-pages-admin`, con dominio propio `routefleet.kavanasystems.com` (raíz `/`).
Estética backoffice, sidebar + tablas densas (pensado para escritorio).

## Tema (Kavana / Clásico)
El panel ofrece dos temas conmutables por pestañas en el sidebar:
- **Kavana**: oscuro industrial (estética de marca).
- **Clásico**: claro estilo CRM (azul corporativo sobre blanco), **predeterminado**
  para oficinas.
La elección se persiste en `localStorage` (`rf_admin_theme`).

## Login (JWT)
Pantalla de PIN de oficina (`POST /api/office/login`) → devuelve un **JWT**
que se guarda en `sessionStorage` y se envía en cada fetch. Botón "Salir"
limpia la sesión. PIN por defecto `0000` (cambiable en Render con
`OFFICE_PIN`).

## Secciones
- **Dashboard**: KPIs (total / entregados / pendientes / incidencias / OPEX
  estimado) + barras de entregas por repartidor (%).
- **Repartidores**: alta (nombre, PIN, teléfono) y activar/desactivar.
- **Repartos**: tabla con filtros por repartidor, estado y rango de fechas.
  Enlace a POD por parada (con `?token=`).
- **Firmas**: galería de firmas de clientes (iframe del POD + descarga PDF),
  filtrable por repartidor y fechas.
- **Incidencias**: lista de incidencias reportadas por los repartidores.

## Variables
- `VITE_API_BASE` (build-time) → `https://routefleet-api.onrender.com`

## Build
```bash
cd client-admin && npm install && npm run build   # → dist/ (base /)
```
