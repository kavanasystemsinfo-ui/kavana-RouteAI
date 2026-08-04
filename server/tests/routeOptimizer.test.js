import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greedyRoute } from '../src/services/routeOptimizer.js';

const stops = [
  { id: 1, lat: 39.50, lng: -0.50 }, // origen-like
  { id: 2, lat: 39.51, lng: -0.48 },
  { id: 3, lat: 39.47, lng: -0.45 },
  { id: 4, lat: 39.55, lng: -0.52 }
];

test('greedyRoute empieza en el origen', () => {
  const [first] = greedyRoute(stops, { lat: 39.50, lng: -0.50 });
  assert.equal(first.id, 1);
});

test('greedyRoute visita todas las paradas sin repetir', () => {
  const order = greedyRoute(stops, { lat: 39.50, lng: -0.50 });
  assert.equal(order.length, stops.length);
  const ids = order.map((s) => s.id);
  assert.equal(new Set(ids).size, stops.length);
});

test('greedyRoute elige la parada mas cercana en cada paso', () => {
  // Desde origen (39.50,-0.50), la mas cercana es id 2 (39.51,-0.48)
  const order = greedyRoute(stops, { lat: 39.50, lng: -0.50 });
  assert.equal(order[1].id, 2);
});

test('greedyRoute con una sola parada devuelve esa parada', () => {
  const order = greedyRoute([stops[2]], { lat: 39.50, lng: -0.50 });
  assert.equal(order.length, 1);
  assert.equal(order[0].id, 3);
});
