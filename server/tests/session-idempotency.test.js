// Regresión P0-3 (auditoría 2026-08-23): startSession es idempotente —
// llamarlo dos veces para el mismo driver NO crea dos sesiones activas.
// En JSON se verifica la lógica; en PG la garantía es el índice único
// parcial (migración 005), verificada sintácticamente en migrations.test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

async function freshDb() {
  const file = path.join(os.tmpdir(), `rf-sess-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

test('startSession doble llamada = una sola sesión activa', async () => {
  const db = await freshDb();
  const q = db.queries;
  const drv = await q.addDriver(db, 'Ana', '2222');
  const s1 = await q.startSession(db, drv, 100);
  const s2 = await q.startSession(db, drv, 120);
  assert.equal(s2, s1, 'la segunda llamada devuelve la sesión ya activa');
  const active = await q.getActiveSession(db, drv);
  assert.equal(active.id, s1);
});

test('drivers distintos sí tienen sesiones independientes', async () => {
  const db = await freshDb();
  const q = db.queries;
  const d1 = await q.addDriver(db, 'A', '1111');
  const d2 = await q.addDriver(db, 'B', '3333');
  const s1 = await q.startSession(db, d1, 10);
  const s2 = await q.startSession(db, d2, 20);
  assert.notEqual(s1, s2);
});

test('tras endSession se puede abrir una nueva', async () => {
  const db = await freshDb();
  const q = db.queries;
  const drv = await q.addDriver(db, 'Luis', '4444');
  const s1 = await q.startSession(db, drv, 100);
  await q.endSession(db, s1, 150);
  const s2 = await q.startSession(db, drv, 150);
  assert.notEqual(s2, s1);
});
