# Troubleshooting — KAVANA Route AI

Casos reales vividos durante el despliegue. Causa → solución.

---

## 1. La app repartidor dice "PIN incorrecto" y luego pantalla negra

**Causa más frecuente (no es bug de la app): el backend perdió la BD.**
En Render FREE el filesystem es efímero: el archivo `routefleet.json` se borra
en cada reinicio/dormida/deploy. El repartidor que creaste ya no existe en el
backend → el login es "incorrecto" de verdad.

**Cómo confirmar:**
```bash
curl -s -X POST https://routefleet-api.onrender.com/api/drivers/login \
  -H "Content-Type: application/json" -d '{"pin":"5855"}'
# Si devuelve {"error":"PIN incorrecto"} → el repartidor no existe en el backend
```

**Solución inmediata (demo):** recrear el repartidor vía API o panel.
```bash
# Obtener token oficina (PIN 0000 por defecto)
TOKEN=$(curl -s -X POST https://routefleet-api.onrender.com/api/office/login \
  -H "Content-Type: application/json" -d '{"pin":"0000"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
# Crear repartidor
curl -s -X POST https://routefleet-api.onrender.com/api/drivers \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"JORGE ADAN","pin":"5855","email":"jorge@kavanasystems.com"}'
```

**Solución definitiva:** ver sección "Persistencia de datos" en DESPLIEGUE.md
(montar Render Disk o migrar a Postgres). No dejar en free efímero en producción.

**Otra causa posible:** `VITE_API_BASE` vacío en el build de la web/app → la
app apunta a `http://<host>:5001` (puerto muerto) y cualquier fallo de red se
muestra como "PIN incorrecto". El código ya tiene fallback a
`https://routefleet-api.onrender.com/api`, así que con el deploy actual no
debería pasar. Si pasa, verificar el secret `VITE_API_BASE` en GitHub.

---

## 2. Pantalla en blanco al abrir la app (PWA)

**Causa:** `VITE_API_BASE` no inyectado en el build → la app no sabe a qué
backend llamar y no renderiza. O bien el navegador tiene una versión
remota (`server.url`) que estaba rota.

**Solución:**
- Rellenar el secret `VITE_API_BASE` = `https://routefleet-api.onrender.com` en
  GitHub (Settings → Secrets → Actions).
- Relanzar el workflow `deploy-combined.yml` para redesplegar la web.

---

## 3. El dominio routefleet.kavanasystems.com da 404 tras un deploy

**Causa:** el push a la rama `gh-pages-admin` desenganchó el custom domain.
Pasaba antes con `force_orphan` y pasa si falta el archivo `CNAME`.

**Solución:**
1. Settings → Pages → el custom domain estará vacío.
2. Reescribir `routefleet.kavanasystems.com` → Save → Enforce HTTPS.
3. Esperar 1-2 min.

**Prevención:** ambos workflows (`deploy-combined.yml` y `build-apk.yml`) ya
escriben `CNAME` en cada push. No debería volver a pasar.

---

## 4. Estrategia de distribución de la app (decisión 15/07/2026)

- **Canal único:** PWA en `/app` + "Añadir a pantalla de inicio"
  (Android Chrome / iPhone Safari). Profesional, se actualiza sola, sin build.
- El APK (Capacitor) fue **descartado** como canal de distribución por su alto
  coste de mantenimiento (build 3-4 min, sin DevTools en móvil). No se genera ni
  se distribuye.

---

## 5. Verificación rápida de salud

```bash
# Backend vivo y CORS ok
curl -s -i https://routefleet-api.onrender.com/api/settings \
  -H "Origin: https://routefleet.kavanasystems.com" | grep -i "access-control\|HTTP/"

# Login repartidor (debe dar success:true si el repartidor existe)
curl -s -X POST https://routefleet-api.onrender.com/api/drivers/login \
  -H "Content-Type: application/json" -d '{"pin":"5855"}'

# Sitio y app
curl -o /dev/null -w "panel %{http_code}\\n" https://routefleet.kavanasystems.com/
curl -o /dev/null -w "app %{http_code}\\n" https://routefleet.kavanasystems.com/app/
```
