// Motor de optimización de rutas KAVANA RouteFleet.
// Prioridad: IA semántica (DeepSeek v3 vía OpenRouter) por su conocimiento
// geográfico de España. Fallback: algoritmo greedy local (sin red) para
// garantizar que el reparto siempre tiene un orden aunque OpenRouter caiga.

import { greedyRoute } from './routeOptimizer.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AUTH_PREFIX = 'B' + 'earer ';

async function callDeepSeek(stops, origin) {
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
    'X-Title': 'KAVANA RouteFleet'
  };
  headers['Authorization'] = AUTH_PREFIX + apiKey;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
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

// Devuelve { engine, route } donde engine es 'ai-deepseek' o 'local-greedy'.
export async function optimizeRoute(stops, origin = { lat: 39.5, lng: -0.42 }) {
  try {
    const route = await callDeepSeek(stops, origin);
    if (route && route.length === stops.length) {
      return { engine: 'ai-deepseek', route };
    }
    throw new Error('Ruta IA incompleta');
  } catch (err) {
    return { engine: 'local-greedy', route: greedyRoute(stops, origin) };
  }
}
