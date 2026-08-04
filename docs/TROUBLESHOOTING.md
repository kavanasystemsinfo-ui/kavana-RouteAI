# Troubleshooting — KAVANA RouteFleet

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
# Obtener token oficina (PIN 4374 por defecto)
TOKEN=$(curl -s -X POST https://routefleet-api.onrender.com/api/office/login \
  -H "Content-Type: application/json" -d '{"pin":"4374"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
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

## 2. Pantalla en blanco al abrir la app (APK o PWA)

**Causa:** `VITE_API_BASE` no inyectado en el build → la app no sabe a qué
backend llamar y no renderiza. O bien la WebView del APK apuntaba a la PWA
remota (`server.url`) que estaba rota.

**Solución:**
- Rellenar el secret `VITE_API_BASE` = `https://routefleet-api.onrender.com` en
  GitHub (Settings → Secrets → Actions).
- Relanzar `build-apk` (Run workflow, no Re-run) y redesplegar la web.
- El `capacitor.config.ts` actual NO usa `server.url`: el APK carga sus assets
  locales con `VITE_API_BASE` embebido. Más robusto.

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

## 4. El workflow build-apk falla

**Errores vistos y solución:**

| Error | Causa | Solución |
|---|---|---|
| `Could not find installation of TypeScript` | Capacitor 5 necesita TS para leer `capacitor.config.ts` | `npm install -D typescript` (ya añadido) |
| `error: unknown option '--force'` en `cap add android` | Capacitor 5 no acepta `--force` | quitar `--force` |
| `android platform has not been added yet` | `cap add` no corrió (por `--force` o `npx` mal resuelto) | usar `./node_modules/.bin/cap add android` |
| `Could not get unknown property 'release'` en Gradle | `signingConfigs` huérfano tras `cap sync` pisar build.gradle | firma en `release-signing.gradle` externo (sobrevive a sync) |
| `app-release.apk: No such file` | el APK no se firmó (sin `release-signing.gradle`) | aplicado en `ac7ea72` |
| `Please commit your changes... would be overwritten by checkout` | build.gradle modificado sucio al cambiar rama | `git checkout -- client/android/app/build.gradle` antes del checkout |

**Regla de oro:** siempre **Run workflow** (nuevo), nunca "Re-run" sobre un run
fallido (ejecuta el YAML viejo del commit anterior).

---

## 5. "Run workflow" vs "Re-run"

- **Re-run** (dentro de un run fallido): reejecuta el YAML tal como estaba
  cuando falló. No sirve para probar fixes.
- **Run workflow** (página del workflow, arriba a la derecha): lanza uno fresco
  contra `main` HEAD. Usar siempre esto tras un push.

---

## 6. El APK no se actualiza solo tras reinstalar

**Diseño:** el APK está firmado con un **keystore fijo** (generado en el PC de
Jorge, secret `ANDROID_KEYSTORE_B64`). Al subir una nueva versión, el repartidor
**actualiza encima** (no desinstala). El banner de "hay nueva versión" consulta
`/app/version.json` y enlaza a `/download/routefleet.apk`.

---

## 7. Estrategia de distribución de la app (decisión 15/07/2026)

- **Canal principal:** PWA en `/app` + "Añadir a pantalla de inicio"
  (Android Chrome / iPhone Safari). Profesional, se actualiza sola, sin build.
- **Alternativa:** APK Capacitor descargable en `/download/routefleet.apk`
  (keystore fijo). Channel secundario para clientes que lo exijan.
- **NO** seguir debugueando Capacitor como wrapper de la web: coste alto
  (build 3-4 min, sin DevTools en móvil). Si un cliente exige APK nativo
  tradicional, generarlo vía **Bubblewrap/TWA** (1 comando, reusa keystore).

---

## 8. Verificación rápida de salud

```bash
# Backend vivo y CORS ok
curl -s -i https://routefleet-api.onrender.com/api/settings \
  -H "Origin: https://routefleet.kavanasystems.com" | grep -i "access-control\|HTTP/"

# Login repartidor (debe dar success:true si el repartidor existe)
curl -s -X POST https://routefleet-api.onrender.com/api/drivers/login \
  -H "Content-Type: application/json" -d '{"pin":"5855"}'

# Sitio y APK
curl -o /dev/null -w "panel %{http_code}\n" https://routefleet.kavanasystems.com/
curl -o /dev/null -w "apk %{http_code}\n" https://routefleet.kavanasystems.com/download/routefleet.apk
```
