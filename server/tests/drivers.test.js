import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

async function freshDb() {
  const file = path.join(os.tmpdir(), `rf-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

test('addDriver y listDrivers', async () => {
  const db = await freshDb();
  const q = db.queries;
  const id = await q.addDriver(db, 'Juan', '1234', '600123456');
  assert.ok(id >= 1);
  const drivers = await q.listDrivers(db);
  assert.equal(drivers.length, 1);
  assert.equal(drivers[0].name, 'Juan');
  assert.equal(drivers[0].pin, '1234');
});

test('setDriverActive toggle', async () => {
  const db = await freshDb();
  const q = db.queries;
  const id = await q.addDriver(db, 'Maria', '5678');
  await q.setDriverActive(db, id, false);
  const drivers = await q.listDrivers(db);
  assert.equal(drivers[0].active, false);
  await q.setDriverActive(db, id, true);
  assert.equal((await q.listDrivers(db))[0].active, true);
});

test('getDriverByPin encuentra', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addDriver(db, 'Luis', '9999');
  const d = await q.getDriverByPin(db, '9999');
  assert.ok(d);
  assert.equal(d.name, 'Luis');
  const miss = await q.getDriverByPin(db, '0000');
  assert.equal(miss, undefined);
});

test('addStop enlaza driver_id y filtros por repartidor', async () => {
  const db = await freshDb();
  const q = db.queries;
  const juan = await q.addDriver(db, 'Juan', '1234');
  const ana = await q.addDriver(db, 'Ana', '9999');
  await q.addStop(db, 1, 'C/ A 1', 'pending', juan);
  await q.addStop(db, 2, 'C/ B 2', 'pending', ana);
  const deJuan = await q.listStops(db, { driver_id: juan });
  assert.equal(deJuan.length, 1);
  assert.equal(deJuan[0].driver_id, juan);
  const todas = await q.listStops(db);
  assert.equal(todas.length, 2);
});

test('listStops filtra por estado y rango de fechas', async () => {
  const db = await freshDb();
  const q = db.queries;
  const d1 = await q.addDriver(db, 'Juan', '1234');
  await q.addStop(db, 1, 'C/ A 1', 'delivered', d1);
  await q.addStop(db, 2, 'C/ B 2', 'pending', d1);
  const entregadas = await q.listStops(db, { status: 'delivered' });
  assert.equal(entregadas.length, 1);
});
