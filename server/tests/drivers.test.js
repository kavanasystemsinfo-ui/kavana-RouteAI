import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, queries } from '../src/db.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

function freshDb() {
  const file = path.join(os.tmpdir(), `rf-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

test('addDriver y listDrivers', () => {
  const db = freshDb();
  const id = queries.addDriver(db, 'Juan', '1234', '600123456');
  assert.ok(id >= 1);
  const drivers = queries.listDrivers(db);
  assert.equal(drivers.length, 1);
  assert.equal(drivers[0].name, 'Juan');
  assert.equal(drivers[0].pin, '1234');
  assert.equal(drivers[0].active, true);
});

test('getDriverByPin encuentra por PIN', () => {
  const db = freshDb();
  const id = queries.addDriver(db, 'Ana', '9999', '600000000');
  const found = queries.getDriverByPin(db, '9999');
  assert.ok(found);
  assert.equal(found.id, id);
  assert.equal(queries.getDriverByPin(db, '0000'), undefined);
});

test('setDriverActive alterna estado', () => {
  const db = freshDb();
  const id = queries.addDriver(db, 'Luis', '1111');
  queries.setDriverActive(db, id, false);
  assert.equal(queries.listDrivers(db)[0].active, false);
});

test('addStop enlaza driver_id y filtros por repartidor', () => {
  const db = freshDb();
  const juan = queries.addDriver(db, 'Juan', '1234');
  const ana = queries.addDriver(db, 'Ana', '9999');
  queries.addStop(db, 1, 'C/ A 1', 'pending', juan);
  queries.addStop(db, 2, 'C/ B 2', 'pending', ana);
  const deJuan = queries.listStops(db, { driver_id: juan });
  assert.equal(deJuan.length, 1);
  assert.equal(deJuan[0].driver_id, juan);
  const todas = queries.listStops(db);
  assert.equal(todas.length, 2);
});

test('listStops filtra por estado y rango de fechas', () => {
  const db = freshDb();
  const d1 = queries.addDriver(db, 'Juan', '1234');
  queries.addStop(db, 1, 'C/ A 1', 'delivered', d1);
  queries.addStop(db, 2, 'C/ B 2', 'pending', d1);
  const entregadas = queries.listStops(db, { status: 'delivered' });
  assert.equal(entregadas.length, 1);
});
