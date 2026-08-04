// Motor de optimización de rutas KAVANA Route AI.
// Prioridad: IA semántica via OpenRouter por su conocimiento
// geográfico de España. Fallback: algoritmo greedy local (sin red) para
// garantizar que el reparto siempre tiene un orden aunque OpenRouter caiga.

import { greedyRoute } from './routeOptimizer.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AUTH_PREFIX = 'Bearer ';

async function callOpenRouter(stops, origin) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');

  const prompt = [
    'Eres un motor de optimización de rutas de reparto en España.',
    'Origen: lat ' + origin.lat + ', lng ' + origin.lng + '.',
    'Paradas (devuelve SOLO un JSON con la clave "order" = array de ids en orden óptimo de visita):',
    JSON.stringify(stops.map((s) => ({ id: s.id, address: s.address })))
  ].join('\n');

  const headers = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://kavanasystems.com',
    'X-Title': 'KAVANA Route AI'
  };
  headers['Authorization'] = AUTH_PREFIX + apiKey;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });

  if (!res.ok) throw new Error('OpenRouter ' + res.status);
  const data = await res.json();
  const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta IA sin JSON');
  const parsed = JSON.parse(match[0]);
  const orderIds = parsed.order || [];
  const byId = new Map(stops.map((s) => [s.id, s]));
  const route = orderIds.map((id) => byId.get(id)).filter(Boolean);
  for (const s of stops) if (!route.includes(s)) route.push(s);
  return route;
}

// Devuelve { engine, route } donde engine es 'ai' o 'local'.
export async function optimizeRoute(stops, origin = { lat: 39.5, lng: -0.42 }) {
  try {
    const route = await callOpenRouter(stops, origin);
    if (route && route.length === stops.length) {
      return { engine: 'ai', route };
    }
    throw new Error('Ruta IA incompleta');
  } catch (err) {
    return { engine: 'local', route: greedyRoute(stops, origin) };
  }
}

// Exportamos también la llamada directa a la IA (sin coordenadas necesarias)
export { callOpenRouter };
