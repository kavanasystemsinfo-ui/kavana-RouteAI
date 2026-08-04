# Historia del Proyecto — KAVANA Route AI

*Evolución, decisiones y aprendizajes desde la idea hasta la producción.*

---

## Fase 0: Concepción (Mayo — Junio 2026)

**Problema:** Empresas de reparto pierden albaranes, no digitalizan firmas de recepción (POD) y las oficinas no tienen visibilidad en tiempo real.

**Decisión inicial:** PWA para el repartidor + panel web para oficinas. Sin app nativa (sin store, actualización instantánea).

---

## Fase 1: MVP Funcional (Junio 2026)

**Decisiones:**
- PWA con React + Vite + Service Worker para offline-first
- Backend Express + JWT + almacenamiento JSON
- Firma digital con Canvas nativo
- OCR con Tesseract.js (gratuito, offline)

**Resultado:**
- ✅ App repartidor: login, escaneo, firma, geolocalización
- ✅ Panel oficina: KPIs, histórico, firmas
- ✅ API REST funcional
- ✅ Despliegue en Render + GitHub Pages

---

## Fase 2: Panel de Control (Julio 2026)

**Objetivo:** Torre de Control con dashboards para oficinas.

**Decisiones:**
- Panel admin independiente (client-admin/) desplegado en GitHub Pages
- KPIs por repartidor, rutas, entregas completadas

**Resultado:**
- ✅ Panel oficina con KPIs en tiempo real
- ✅ Visualización de firmas (POD) en web
- ✅ Histórico de entregas por repartidor

---

## Resumen

```
May 2026  │  Concepción: idea, investigación de mercado
Jun 2026  │  F1: MVP (PWA, Express, OCR, firma digital, geoloc)
Jul 2026  │  F2: Panel oficina (KPIs, histórico, POD viewer)
```

**Última actualización:** 2026-07-23
