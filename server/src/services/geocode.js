// Geocodificación de direcciones a coordenadas (lat/lng).
// Usa Nominatim (OpenStreetMap) — gratuito, sin API key.
// Se cachea en memoria para no repetir peticiones iguales en el mismo arranque.
// V2: fallbacks para mejorar acierto con direcciones españolas.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Caché simple en memoria: address -> {lat, lng}
const cache = new Map();

let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    const delay = 1000 - timeSinceLast;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
}

async function tryGeocode(query) {
  await rateLimit();
  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}&countrycodes=es`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KAVANA-Route-AI/1.0 (routeai@kavanasystems.com)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// Extrae el código postal español (5 dígitos)
function extractCP(address) {
  const m = address.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

// Extrae el tipo de vía + nombre (ej: "Calle Bordadores")
function extractStreet(address) {
  const m = address.match(/\b(Calle|C\/|Av\.?|Avenida|Avda\.?|Plaza|Carrer|Ronda|Paseo|Ctra\.?|Crta\.?|Camino|Polígono)\s+[^,\d-]+/i);
  return m ? m[0].trim() : null;
}

// Genera queries de fallback para mejorar acierto
function buildFallbacks(address) {
  const fallbacks = [address];

  // 1) Sin paréntesis: "Calle X, N - CP Ciudad (Zona)" → "Calle X, N - CP Ciudad"
  const noParens = address.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (noParens !== address && noParens.length > 5) fallbacks.push(noParens);

  // 2) Solo calle + número + código postal (sin zona)
  const simple = address
    .replace(/\s*[-–]\s*\d{5}.*$/, '')  // quita "- 46004 ..."
    .replace(/\([^)]*\)/g, '')            // quita "(Zona)"
    .trim();
  if (simple.length > 5 && simple !== address) {
    fallbacks.push(`${simple}, Valencia`);
    fallbacks.push(`${simple}, Valencia, España`);
  }

  // 3) Usar el código postal como ancla geográfica
  const cp = extractCP(address);
  const street = extractStreet(address);
  const number = (address.match(/(\d+)\s*[-–]/) || address.match(/,\s*(\d+)\b/))?.[1] || '';
  if (cp && street) {
    fallbacks.push(`${street} ${number}, ${cp} Valencia`);
    fallbacks.push(`${street} ${number}, ${cp} Valencia, España`);
    // Sin número por si acaso
    fallbacks.push(`${street}, ${cp} Valencia`);
  }

  // 4) Solo calle + Valencia forzado
  if (street) {
    fallbacks.push(`${street} ${number}, Valencia, España`);
    fallbacks.push(`${street} ${number}, Valencia`);
  }

  return [...new Set(fallbacks)]; // dedup
}

// Área de Valencia ciudad aprox (bounding box)
function isInValencia(lat, lng) {
  return lat > 39.35 && lat < 39.60 && lng > -0.45 && lng < -0.30;
}

export async function geocodeAddress(address) {
  if (!address) return null;
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const queries = buildFallbacks(address);
  let result = null;

  for (const q of queries) {
    result = await tryGeocode(q);
    if (result) {
      // Si está en Valencia, ok. Si no, sigue buscando
      if (isInValencia(result.lat, result.lng)) break;
      result = null; // descarta, sigue con el siguiente fallback
    }
  }

  cache.set(key, result);
  return result;
}
