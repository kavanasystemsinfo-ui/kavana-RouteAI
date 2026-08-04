// Optimización de rutas con 2-opt (sin IA, sin coste, sin internet).
// Algoritmo determinístico que encuentra rutas casi óptimas para reparto.
// 
// Cómo funciona:
// 1. Genera ruta inicial con vecino más cercano (greedy)
// 2. Aplica 2-opt: intercambia segmentos de la ruta y si mejora, lo deja
// 3. Repite hasta que no se pueda mejorar más

function haversine(a, b) {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distancia total de una ruta (suma de segmentos consecutivos)
function totalDistance(route, origin) {
  if (!route || route.length === 0) return 0;
  let dist = haversine(origin, route[0]);
  for (let i = 0; i < route.length - 1; i++) {
    dist += haversine(route[i], route[i + 1]);
  }
  return dist;
}

// Vecino más cercano (greedy) — ruta inicial rápida
function greedyRoute(stops, origin) {
  if (!stops || stops.length === 0) return [];
  const remaining = [...stops];
  const route = [];
  let current = { lat: origin.lat, lng: origin.lng };

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    route.push(next);
    current = { lat: next.lat, lng: next.lng };
  }
  return route;
}

// Mejora 2-opt: intercambia segmentos para acortar la ruta
// Itera hasta que ninguna mejora sea posible
function twoOpt(route, origin) {
  if (!route || route.length < 3) return route;

  let improved = true;
  let best = [...route];

  while (improved) {
    improved = false;
    const currentDist = totalDistance(best, origin);

    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        // Invertir el segmento entre i y j
        const swapped = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1)
        ];

        if (totalDistance(swapped, origin) < currentDist) {
          best = swapped;
          improved = true;
          break; // Reiniciar con la nueva ruta mejorada
        }
      }
      if (improved) break;
    }
  }

  return best;
}

// Motor principal: combina greedy + 2-opt
export function optimizeRoute(stops, origin) {
  if (!stops || stops.length === 0) return [];
  if (stops.length === 1) return stops;

  // Fase 1: ruta inicial rápida con vecino más cercano
  const initial = greedyRoute(stops, origin);

  // Fase 2: mejorar con 2-opt
  const optimized = twoOpt(initial, origin);

  return optimized;
}
