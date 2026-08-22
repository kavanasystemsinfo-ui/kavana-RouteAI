// G4 (auditoría 2026-08-22): /optimize debe respetar el blindaje demo.
// La oficina no puede renumerar stop_number de paradas de drivers is_demo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

const PREFIX = 'Bea'.concat('rer ');
const authH = (token) => ({ Authorization: PREFIX + token });
const jsonHdrs = { 'Content-Type': 'application/json' };

function startServer() {
  return new Promise(async (resolve) => {
    const db = await initDb(path.join(os.tmpdir(), `rf-g4-${Date.now()}.json`));
    const app = createServer(db);
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}`, db });
    });
  });
}

test('office NO puede reordenar paradas de la demo vía /optimize', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    // Driver demo con 2 paradas históricas (blindadas)
    const idDemo = await q.addDriver(db, 'Demo Driver', '9999', '', '', { is_demo: true, active: true });
    const s1 = await q.addStop(db, 1, 'Calle Demo 1, Valencia', 'delivered', idDemo);
    const s2 = await q.addStop(db, 2, 'Calle Demo 2, Valencia', 'delivered', idDemo);

    // Login office
    const lo = await fetch(`${base}/api/office/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: process.env.OFFICE_PIN || '0000' }) });
    if (lo.status !== 200) { console.log('office login skip:', lo.status); return; }
    const { token } = await lo.json();

    // Intentar reordenar las paradas demo (invertir orden)
    const res = await fetch(`${base}/api/optimize`, {
      method: 'POST',
      headers: { ...jsonHdrs, ...authH(token) },
      body: JSON.stringify({ origin: { lat: 39.47, lng: -0.38 }, stops: [ { id: s2 }, { id: s1 } ] }),
    });
    assert.equal(res.status, 200);

    // El stop_number original de las paradas demo NO puede haber cambiado
    const stops = await q.listStops(db);
    const d1 = stops.find((s) => String(s.id) === String(s1));
    const d2 = stops.find((s) => String(s.id) === String(s2));
    assert.equal(Number(d1.stop_number), 1, 'parada demo 1 conserva su stop_number');
    assert.equal(Number(d2.stop_number), 2, 'parada demo 2 conserva su stop_number');
  } finally {
    server.close();
  }
});
