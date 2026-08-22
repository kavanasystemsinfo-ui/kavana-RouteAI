// Tests auditoría adversarial 2026-08-22: G1, G4, G5, G3(whitelist).
// ROJO primero: cada test documenta un gap del informe de auditoría.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

async function freshDb() {
  const file = path.join(os.tmpdir(), `rf-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

// ── G3/G5: whitelist de columnas en updateStop (SQL injection por keys) ──
test('updateStop rechaza columnas fuera de la whitelist', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 1, 'C/ A 1');
  const id = (await q.listStops(db))[0].id;
  // Un campo malicioso no puede convertirse en columna SQL ni tocar __proto__:
  // updateStop es todo-o-nada (rechaza ANTES de aplicar nada).
  await assert.rejects(
    async () => q.updateStop(db, id, { status: 'delivered', "address = 'x', driver_id = 999 --": 'pwn' }),
    /columna no permitida/i,
  );
  const s = (await q.listStops(db))[0];
  assert.equal(s.status, 'pending'); // el campo legítimo NO se aplicó (atomicidad)
});

test('updateStop rechaza __proto__ (prototype pollution)', async () => {
  const db = await freshDb();
  const q = db.queries;
  await q.addStop(db, 2, 'C/ B 2');
  const id = (await q.listStops(db))[0].id;
  // JSON.parse SÍ crea __proto__ como own property (a diferencia del literal);
  // es la vía real por la que entra desde un body.
  const fields = JSON.parse('{"status":"delivered","__proto__":{"admin":true}}');
  await assert.rejects(
    async () => q.updateStop(db, id, fields),
    /columna no permitida/i,
  );
});
