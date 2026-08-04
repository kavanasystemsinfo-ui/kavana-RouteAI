// Algoritmo greedy de vecino más cercano (fallback local de optimización de ruta).
// Se usa cuando el motor de IA (DeepSeek v3) no está disponible, garantizando
// que el reparto siempre tenga un orden de visita sin depender de red.

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

// Devuelve el orden de visita (array de paradas) empezando desde `origin`.
export function greedyRoute(stops, origin) {
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
