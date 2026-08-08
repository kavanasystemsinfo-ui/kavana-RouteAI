// Tests de seguridad/autorización — RouteAI (P2)
// Verifican: driver ownership, endpoints protegidos, JWT enforcement
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import os from 'os';
import path from 'path';

const PREFIX = 'Bea'.concat('rer ');
const authH = (token) => ({ Authorization: PREFIX.concat(token) });
const jsonHdrs = { 'Content-Type': 'application/json' };

function startServer() {
  return new Promise(async (resolve) => {
    const db = await initDb(path.join(os.tmpdir(), `rf-auth-${Date.now()}.json`));
    const app = createServer(db);
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}`, db });
    });
  });
}

test('driver A no puede ver paradas de driver B via GET /stops', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    await q.addStop(db, 1, 'Calle A, Valencia', 'pending', idA);
    await q.addStop(db, 2, 'Calle B, Valencia', 'pending', idB);
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    const res = await fetch(`${base}/api/stops`, { headers: authH(tokA) });
    assert.equal(res.status, 200);
    const stops = await res.json();
    assert.ok(stops.every((s) => s.driver_id === idA), 'driver A solo ve sus paradas');
  } finally { server.close(); }
});

test('driver A no puede modificar (PATCH) stop de driver B', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    await q.addStop(db, 1, 'Calle B, Valencia', 'pending', idB);
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    const res = await fetch(`${base}/api/stops/1`, { method: 'PATCH', headers: { ...jsonHdrs, ...authH(tokA) }, body: JSON.stringify({ status: 'delivered', signature: 'fake' }) });
    assert.equal(res.status, 403, 'driver A no puede tocar stop de B');
  } finally { server.close(); }
});

test('driver A no puede borrar (DELETE) stop de driver B', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    await q.addStop(db, 1, 'Calle B, Valencia', 'pending', idB);
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    const res = await fetch(`${base}/api/stops/1`, { method: 'DELETE', headers: authH(tokA) });
    assert.equal(res.status, 403, 'driver A no puede borrar stop de B');
  } finally { server.close(); }
});

test('POST /optimize sin JWT devuelve 401', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const id = await q.addDriver(db, 'Alicia', '1111');
    await q.addStop(db, 1, 'Calle A, Valencia', 'pending', id);
    await q.addStop(db, 2, 'Calle B, Valencia', 'pending', id);
    const res = await fetch(`${base}/api/optimize`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({}) });
    assert.equal(res.status, 401, 'optimize requiere JWT');
  } finally { server.close(); }
});

test('GET /pods/* sin JWT devuelve 401', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/pods/nonexistent.pdf`);
    assert.equal(res.status, 401, 'pods requiere JWT');
  } finally { server.close(); }
});

test('POST /ocr sin JWT devuelve 401', async () => {
  const { server, base } = await startServer();
  try {
    const form = new FormData();
    form.append('image', new Blob(['fake']), 'test.png');
    const res = await fetch(`${base}/api/ocr`, { method: 'POST', body: form });
    assert.equal(res.status, 401, 'ocr requiere JWT');
  } finally { server.close(); }
});

test('POST /stops/bulk driver A ignora driver_id del body (usa JWT)', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    const res = await fetch(`${base}/api/stops/bulk`, { method: 'POST', headers: { ...jsonHdrs, ...authH(tokA) }, body: JSON.stringify({ addresses: ['Calle X, Valencia'], driver_id: idB }) });
    assert.equal(res.status, 200);
    const stops = await fetch(`${base}/api/stops`, { headers: authH(tokA) });
    const list = await stops.json();
    assert.ok(list.length >= 1, 'hay al menos una parada');
    assert.ok(list.every((s) => s.driver_id === idA), 'se asigno al JWT (driver A), no al body (B)');
  } finally { server.close(); }
});
