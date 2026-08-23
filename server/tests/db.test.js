import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, queries } from '../src/db.js';
import os from 'os';
import path from 'path';

async function freshDb() {
  const file = path.join(os.tmpdir(), `rf-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

test('addStop y listStops', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1');
  await q.addStop(db, 2, 'C/ B 2');
  const stops = await q.listStops(db);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].address, 'C/ A 1');
});

test('updateStop cambia campos', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1');
  const stops = await q.listStops(db);
  const id = stops[0].id;
  await q.updateStop(db, id, { status: 'delivered', receiver_name: 'Juan' });
  const s = (await q.listStops(db))[0];
  assert.equal(s.status, 'delivered');
  assert.equal(s.receiver_name, 'Juan');
});

test('deleteStop y clearStops', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1');
  await q.addStop(db, 2, 'C/ B 2');
  await q.deleteStop(db, 1);
  assert.equal((await q.listStops(db)).length, 1);
  await q.clearStops(db);
  assert.equal((await q.listStops(db)).length, 0);
});

test('addIncident', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1');
  const stops = await q.listStops(db);
  await q.addIncident(db, stops[0].id, 'photo_data' in {} ? 'foto' : 'test');
  // Sin asserts adicionales por ahora (solo verificar que no lanza)
  assert.ok(true);
});

test('setSetting y getSettings', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.setSetting(db, 'cost_per_km', 0.5);
  const s = await q.getSettings(db);
  assert.equal(s.cost_per_km, 0.5);
  assert.equal(s.cost_per_hour, 15);
});

test('addDriver y listDrivers', async () => {
  const db = await freshDb();
  const q = db.queries;
  const id = await q.addDriver(db, 'Juan', '1234', '600123456');
  assert.ok(id >= 1);
  const drivers = await q.listDrivers(db);
  assert.equal(drivers.length, 1);
  assert.equal(drivers[0].name, 'Juan');
  // P0-1 (2026-08-23): el PIN se almacena hasheado (scrypt), nunca plano.
  assert.match(drivers[0].pin, /^scrypt\$/);
});

test('savePod y driver CRUD', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1');
  const stops = await q.listStops(db);
  const sid = stops[0].id;
  await q.savePod(db, sid, '/pods/test.pdf');
  const pod = await q.getStopPods(db, sid);
  assert.ok(pod);
  assert.ok(pod.file_path.includes('test.pdf'));
});
