// Regresión P0-1 (auditoría 2026-08-23): los PINs de drivers NO pueden
// almacenarse en texto plano. Cubre pinHash.js, addDriver (ambos adapters),
// login con PIN hasheado y el backfill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin, isHashedPin } from '../src/pinHash.js';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

async function freshDb() {
  const file = path.join(os.tmpdir(), `rf-pin-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return initDb(file);
}

test('hashPin produce formato scrypt con salt aleatoria', () => {
  const h1 = hashPin('1234');
  const h2 = hashPin('1234');
  assert.ok(isHashedPin(h1));
  assert.notEqual(h1, h2, 'dos hashes del mismo PIN difieren (salt aleatoria)');
  assert.match(h1, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
});

test('verifyPin acepta el PIN correcto y rechaza el incorrecto', () => {
  const stored = hashPin('5855');
  assert.equal(verifyPin('5855', stored), true);
  assert.equal(verifyPin('5856', stored), false);
});

test('verifyPin acepta PIN legacy en texto plano (ventana de despliegue)', () => {
  assert.equal(verifyPin('1234', '1234'), true);
  assert.equal(verifyPin('9999', '1234'), false);
});

test('addDriver almacena el PIN hasheado, nunca plano', async () => {
  const db = await freshDb();
  const id = await db.queries.addDriver(db, 'Test', '4321');
  const drivers = await db.queries.listDrivers(db);
  const d = drivers.find((x) => x.id === id);
  assert.ok(isHashedPin(d.pin), `pin almacenado: ${d.pin.slice(0, 20)}...`);
  assert.equal(verifyPin('4321', d.pin), true);
});

test('login funciona con PIN hasheado end-to-end (flujo verifyPin como auth.routes)', async () => {
  const db = await freshDb();
  await db.queries.addDriver(db, 'Raúl', '1111');
  const drivers = await db.queries.listDrivers(db);
  const d = drivers.find((x) => x.active && verifyPin('1111', x.pin));
  assert.ok(d, 'el driver activo se autentica tras el hash');
});

test('backfillPinHashes convierte legacy y es idempotente', async () => {
  const db = await freshDb();
  // Insertar fila "legacy" simulando estado pre-migración
  db._store.drivers.push({ id: 99, name: 'Legacy', pin: '7777', phone: '', email: '', active: true,
    fuel_type: '', cost_per_km: 0, is_demo: false, session_id: '', expira_en: null });
  db._save();
  const { backfillPinHashes } = await import('../src/pinBackfill.js');
  await backfillPinHashes(db);
  let d = db._store.drivers.find((x) => x.id === 99);
  assert.ok(isHashedPin(d.pin));
  assert.equal(verifyPin('7777', d.pin), true);
  // Segunda pasada = no-op sin errores
  await backfillPinHashes(db);
  d = db._store.drivers.find((x) => x.id === 99);
  assert.equal(verifyPin('7777', d.pin), true);
});
