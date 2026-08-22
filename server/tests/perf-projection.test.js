// G6 (auditoría 2026-08-22): proyección lite en listStops — excluye campos
// pesados (items, session_id, expira_en) manteniendo el resto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

async function freshDb() {
  const file = path.join(os.tmpdir(), `rf-lite-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

test('listStops con lite=true excluye items/session_id/expira_en', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1', 'delivered', null, '[{"name":"caja","checked":true}]');
  const full = (await q.listStops(db))[0];
  assert.ok(full.items && full.session_id !== undefined);

  const lite = (await q.listStops(db, { lite: true }))[0];
  assert.equal(lite.items, undefined, 'items excluido en lite');
  assert.equal(lite.session_id, undefined, 'session_id excluido en lite');
  assert.equal(lite.expira_en, undefined, 'expira_en excluido en lite');
  // lo esencial se conserva
  assert.equal(lite.address, 'C/ A 1');
  assert.equal(lite.status, 'delivered');
});

test('listSessionsJoined filtra por from/to y añade driver_name', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addDriver(db, 'Ana', '1111', '', '', { active: true });
  const id = (await q.listDrivers(db))[0].id;
  await q.startSession(db, id, 25000);
  const all = await q.listSessionsJoined(db);
  assert.equal(all.length, 1);
  assert.equal(all[0].driver_name, 'Ana');
  // filtro excluyente: rango anterior a la sesión
  const none = await q.listSessionsJoined(db, { from: '2000-01-01T00:00:00Z', to: '2000-01-02T00:00:00Z' });
  assert.equal(none.length, 0);
});
