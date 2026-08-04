import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeRoute } from '../src/services/aiService.js';
import { greedyRoute } from '../src/services/routeOptimizer.js';

// ORIGEN y PARADAS fijos para el test (coordenadas de Paterna, Valencia).
const ORIGIN = { lat: 39.500, lng: -0.420 };
const STOPS = [
  { id: 1, lat: 39.495, lng: -0.410, address: 'C/ A 1' },
  { id: 2, lat: 39.505, lng: -0.430, address: 'C/ B 2' }
];

test('sin API key, optimizeRoute usa fallback greedy', async () => {
  delete process.env.OPENROUTER_API_KEY;
  const result = await optimizeRoute(STOPS, ORIGIN);
  assert.equal(result.engine, 'local-greedy');
  assert.equal(result.route.length, STOPS.length);
});

test('con API key ausente no lanza, devuelve orden valido', async () => {
  delete process.env.OPENROUTER_API_KEY;
  const result = await optimizeRoute(STOPS, ORIGIN);
  const ids = result.route.map((s) => s.id);
  assert.equal(new Set(ids).size, STOPS.length);
});

test('greedyRoute exportado es deterministico', () => {
  const a = greedyRoute(STOPS, ORIGIN).map((s) => s.id);
  const b = greedyRoute(STOPS, ORIGIN).map((s) => s.id);
  assert.deepEqual(a, b);
});
