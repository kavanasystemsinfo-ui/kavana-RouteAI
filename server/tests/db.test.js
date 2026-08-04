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

test('addStop y listStops', () => {
  const db = freshDb();
  queries.addStop(db, 1, 'C/ A 1');
  queries.addStop(db, 2, 'C/ B 2');
  const stops = queries.listStops(db);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].address, 'C/ A 1');
});

test('updateStop cambia campos', () => {
  const db = freshDb();
  queries.addStop(db, 1, 'C/ A 1');
  const id = queries.listStops(db)[0].id;
  queries.updateStop(db, id, { status: 'delivered', receiver_name: 'Juan' });
  const s = queries.listStops(db)[0];
  assert.equal(s.status, 'delivered');
  assert.equal(s.receiver_name, 'Juan');
});

test('deleteStop y clearStops', () => {
  const db = freshDb();
  queries.addStop(db, 1, 'C/ A 1');
  const id = queries.listStops(db)[0].id;
  queries.deleteStop(db, id);
  assert.equal(queries.listStops(db).length, 0);
  queries.addStop(db, 1, 'X');
  queries.addStop(db, 2, 'Y');
  queries.clearStops(db);
  assert.equal(queries.listStops(db).length, 0);
});

test('settings y POD', () => {
  const db = freshDb();
  queries.setSetting(db, 'cost_per_km', '0.5');
  assert.equal(queries.getSettings(db).cost_per_km, 0.5);
  queries.savePod(db, 3, '/pods/3.pdf');
  assert.equal(db._store.pods[3], '/pods/3.pdf');
});
