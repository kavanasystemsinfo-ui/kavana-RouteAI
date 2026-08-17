# ADR-005: Despliegue frontend con GitHub Actions + Pages

**Estado:** ✅ Implementado (backend migrado a Fly.io el 2026-08-17)  
**Fecha:** Julio 2026 (actualizado Agosto 2026)  
**Contexto:** El ecosistema RouteAI tiene dos frontends (Torre de Control y App
  de repartidor) y un backend (API). Cada uno necesita un método de despliegue.

---

## Contexto

RouteAI tiene:
- **Backend API** (Node.js + Express) → necesita un servidor persistente
- **Torre de Control** (React + Vite) → SPA estática
- **App repartidor** (React + Vite + web responsive) → SPA estática

Se evaluaron distintas combinaciones de hosting.

## Problema

- El backend necesita Node.js, proceso persistente, base de datos
- Los frontends son SPAs puras: solo archivos estáticos (HTML, JS, CSS)
- Se busca coste 0 para MVP
- Se necesita CI/CD automatizado desde GitHub

## Decisión

| Componente | Plataforma | Motivo |
|------------|-----------|--------|
| **Backend API** | Fly.io (máquina 256MB, volumen `routeai_data`) | Node persistente con volumen para PODs/fotos; auto-stop/start sin suspender el servicio. Migrado desde Render free (suspendido por límite de horas, 2026-08) |
| **Frontends** | GitHub Pages | Estático, gratuito, CDN global |
| **CI/CD** | GitHub Actions | Build automático + deploy a Pages |

El workflow de Actions:
1. Build ambos frontends (`client-admin` y `client`)
2. Ensambla en `gh-pages-admin/` (Torre en raíz, app en `/app`)
3. Publica en rama `gh-pages-admin`
4. Sincroniza a `gh-pages` (rama que GitHub Pages sirve)

## Alternativas evaluadas

| Alternativa | Pro | Contra |
|-------------|-----|--------|
| **GitHub Pages + Fly.io** | 0€ (free tier), volumen persistente, auto-stop | Dos plataformas que monitorizar |
| GitHub Pages + Render | Simple | Free tier suspende el servicio al agotar horas (ocurrió 2026-08) y no tiene volumen gratis |
| Vercel (todo) | Una plataforma, serverless | No necesario para SPAs, añade complejidad |
| Netlify + Render | Similar a GH Pages | Menor integración con GitHub |

## Consecuencias

**Positivas:**
- Sin coste de infraestructura
- Despliegue automático con cada push a `main`
- Dominio personalizado con SSL gratuito (Let's Encrypt vía Pages)
- Backend con volumen persistente: los PODs y fotos ya no se pierden en cada redeploy

**Negativas:**
- Dos plataformas que monitorizar (Fly.io + GitHub)
- SI hay cambio de DNS, hay que actualizar en Namecheap + GitHub Pages

## Dónde está

- `.github/workflows/deploy-combined.yml` — pipeline de build + deploy
- `server/Dockerfile` + `server/fly.toml` — configuración del backend en Fly.io
- `render.yaml` — configuración histórica del backend en Render (ya no se usa)
