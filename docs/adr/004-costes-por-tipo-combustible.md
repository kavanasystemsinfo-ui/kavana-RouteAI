# ADR-004: Costes por tipo de combustible

**Estado:** ✅ Implementado  
**Fecha:** Julio 2026  
**Contexto:** El OPEX real (ADR-003) necesita un coste por km. Distintos vehículos
  tienen distintos consumos y tipos de combustible con precios diferentes.

---

## Contexto

El coste por km no es homogéneo: un vehículo diésel gasta menos que uno de gasolina,
y un eléctrico tiene un coste energético muy inferior.

Inicialmente se implementó un campo de `cost_per_km` por conductor, pero esto
obligaba a configurar cada conductor individualmente.

## Problema

- 4 tipos de combustible con costes muy distintos:
  - Diésel: ~0,30€/km
  - Gasolina: ~0,35€/km
  - Híbrido: ~0,28€/km
  - Eléctrico: ~0,15€/km
- Configurar el coste conductor por conductor es tedioso y propenso a errores
- Si cambia el precio del combustible, hay que actualizar N conductores

## Decisión

Centralizar los costes por tipo de combustible en la **sección "Costes"** de la
Torre de Control:

1. El panel de Costes muestra 4 inputs (uno por tipo de combustible)
2. El supervisor asigna a cada repartidor su **tipo de combustible** desde su perfil en la Torre de Control
3. El sistema calcula el OPEX usando: `coste_del_tipo_asignado × km_reales`
4. Si el repartidor no tiene tipo asignado, usa el coste genérico (0,30€)

## Alternativas evaluadas

| Alternativa | Pro | Contra |
|-------------|-----|--------|
| **Coste centralizado por combustible** | Un solo cambio actualiza todos, fácil | Si un conductor tiene un vehículo atípico, no aplica |
| Coste por conductor | Personalizado | Mucha configuración manual |
| Coste único global | Simple | Impreciso, no refleja realidad |

## Consecuencias

**Positivas:**
- Un cambio en Costes actualiza a todos los repartidores de ese combustible
- El repartidor no necesita saber nada de costes: el supervisor le asigna el tipo
- Fácil de mantener cuando cambian los precios

**Negativas:**
- Si dos vehículos del mismo combustible tienen consumos muy distintos,
  el coste único no refleja la diferencia

## Dónde está

- `client-admin/src/App.jsx` — secciones "Costes" y "Repartidores"
- `server/src/db.js` — settings para cada tipo de combustible
