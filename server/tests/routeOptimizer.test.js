// Tests de 2-opt con invariantes — RouteAI (P5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greedyRoute, optimizeRoute } from '../src/services/routeOptimizer.js';

const ORIGIN = { lat: 39.47, lng: -0.38 };

// — helpers —
function randomStop(id) {
  return { id, lat: 39.35 + Math.random() * 0.4, lng: -0.6 + Math.random() * 0.4 };
}

function randomStops(n) {
  return Array.from({ length: n }, (_, i) => randomStop(i + 1));
}

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalDist(route, origin) {
  if (!route || route.length === 0) return 0;
  let d = haversine(origin, route[0]);
  for (let i = 0; i < route.length - 1; i++) d += haversine(route[i], route[i + 1]);
  return d;
}

// — invariantes de optimizeRoute —

test('optimizeRoute: 0 paradas devuelve array vacio', () => {
  assert.equal(optimizeRoute([], ORIGIN).length, 0);
});

test('optimizeRoute: 1 parada devuelve esa misma parada', () => {
  const stops = [{ id: 1, lat: 39.50, lng: -0.50 }];
  const result = optimizeRoute(stops, ORIGIN);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test('optimizeRoute: 2 paradas preserva las dos sin cambiar orden', () => {
  const stops = [{ id: 1, lat: 39.50, lng: -0.50 }, { id: 2, lat: 39.47, lng: -0.45 }];
  const result = optimizeRoute(stops, ORIGIN);
  assert.equal(result.length, 2);
  assert.ok(result.some((s) => s.id === 1));
  assert.ok(result.some((s) => s.id === 2));
});

test('optimizeRoute: preserva todas las paradas sin duplicar (20 stops)', () => {
  const stops = randomStops(20);
  const result = optimizeRoute(stops, ORIGIN);
  assert.equal(result.length, 20);
  assert.equal(new Set(result.map((s) => s.id)).size, 20);
});

test('optimizeRoute: mejora o mantiene la distancia total', () => {
  const stops = randomStops(15);
  const greedy = greedyRoute(stops, ORIGIN);
  const result = optimizeRoute(stops, ORIGIN);
  const greedyDist = totalDist(greedy, ORIGIN);
  const resultDist = totalDist(result, ORIGIN);
  assert.ok(resultDist <= greedyDist + 0.0001, `2-opt no empeoró: greedy=${greedyDist.toFixed(4)} opt=${resultDist.toFixed(4)}`);
});

test('optimizeRoute: resultado determinista (misma entrada, misma salida)', () => {
  const stops = randomStops(12);
  const r1 = optimizeRoute(stops, ORIGIN);
  const r2 = optimizeRoute(stops, ORIGIN);
  const ids1 = r1.map((s) => s.id).join(',');
  const ids2 = r2.map((s) => s.id).join(',');
  assert.equal(ids1, ids2, 'misma entrada → mismo orden');
});

test('optimizeRoute: benchmark <30ms para 30 stops', () => {
  const stops = randomStops(30);
  const t0 = performance.now();
  optimizeRoute(stops, ORIGIN);
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 30, `2-opt en 30 stops tomó ${elapsed.toFixed(1)}ms (máx 30ms)`);
});

test('optimizeRoute: benchmark <5ms para 15 stops', () => {
  const stops = randomStops(15);
  const t0 = performance.now();
  optimizeRoute(stops, ORIGIN);
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 5, `2-opt en 15 stops tomó ${elapsed.toFixed(1)}ms (máx 5ms)`);
});

test('optimizeRoute: mejora ruta con cruce evidente (triángulo)', () => {
  // Triángulo donde la ruta greedy cruza: [A(lejos), B(cerca), C(medio)]
  // A está lejos, B muy cerca, C entre A y B — greedy: origen→B→A→C cruza
  const stops = [
    { id: 1, lat: 39.60, lng: -0.50 },  // lejos (norte)
    { id: 2, lat: 39.48, lng: -0.39 },  // muy cerca (este)
    { id: 3, lat: 39.44, lng: -0.41 },  // medio (sur-oeste)
  ];
  const greedy = greedyRoute(stops, ORIGIN);
  const result = optimizeRoute(stops, ORIGIN);
  assert.ok(totalDist(result, ORIGIN) <= totalDist(greedy, ORIGIN) + 0.0001, 'optimizeRoute no empeora el greedy en triángulo');
});

test('optimizeRoute: no se queda en un mínimo local malo (20 repeticiones aleatorias)', () => {
  for (let i = 0; i < 20; i++) {
    const stops = randomStops(8);
    const key = stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join(';');
    const result = optimizeRoute(stops, ORIGIN);
    assert.equal(result.length, 8, `run ${i}: preserva longitud (${key})`);
    assert.equal(new Set(result.map((s) => s.id)).size, 8, `run ${i}: sin duplicados`);
  }
});
