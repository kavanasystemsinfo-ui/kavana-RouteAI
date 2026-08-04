import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, queries } from '../src/db.js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
function freshDb() {
  const db = new Database(':memory:');
  // initDb usa ruta por defecto; replicamos schema en memoria para el test.
  db.exec(`
    CREATE TABLE stops (id INTEGER PRIMARY KEY AUTOINCREMENT, stop_number INTEGER, address TEXT, status TEXT DEFAULT 'pending', signature TEXT, receiver_name TEXT, lat REAL, lng REAL, created_at TEXT);
    CREATE TABLE incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, stop_id INTEGER, type TEXT, photo_data TEXT, notes TEXT, created_at TEXT);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE pods (stop_id INTEGER PRIMARY KEY, file_path TEXT, created_at TEXT);
  `);
  return db;
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
  const row = db.prepare('SELECT * FROM pods WHERE stop_id=3').get();
  assert.equal(row.file_path, '/pods/3.pdf');
});
