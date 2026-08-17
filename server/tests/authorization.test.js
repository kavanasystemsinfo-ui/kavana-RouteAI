// Tests de seguridad/autorización — RouteAI (P2)
// Verifican: driver ownership, endpoints protegidos, JWT enforcement
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import { verifyToken } from '../src/auth.js';
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

// ── P0/P1 Fase 1 (auditoría 2026-08-17): IDORs por ownership ──────────────

test('driver A NO puede borrar la ruta completa (DELETE /stops masivo) — solo office', async () => {
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
    const res = await fetch(`${base}/api/stops`, { method: 'DELETE', headers: authH(tokA) });
    assert.equal(res.status, 403, 'driver no puede borrado masivo');
    const list = await q.listStops(db);
    assert.equal(list.length, 2, 'las paradas siguen existiendo');
  } finally { server.close(); }
});

test('driver A NO puede reportar incidencia sobre parada de driver B (POST /stops/:id/incident)', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    const stopB = await q.addStop(db, 1, 'Calle B, Valencia', 'pending', idB);
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    const res = await fetch(`${base}/api/stops/${stopB}/incident`, { method: 'POST', headers: { ...jsonHdrs, ...authH(tokA) }, body: JSON.stringify({ type: 'incidencia', notes: 'otro driver' }) });
    assert.equal(res.status, 403, 'driver A no puede marcar incidente en parada de B');
    const stops = await q.listStops(db);
    assert.notEqual(stops.find((s) => s.id === stopB).status, 'incident', 'la parada de B sigue sin incidencia');
  } finally { server.close(); }
});

test('driver A NO puede leer el POD (firma) de una parada de driver B (GET /stops/:id/pod)', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    const stopB = await q.addStop(db, 1, 'Calle B, Valencia', 'delivered', idB);
    await q.updateStop(db, stopB, { status: 'delivered', signature: 'firma-de-B', receiver_name: 'Cliente B' });
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    const res = await fetch(`${base}/api/stops/${stopB}/pod`, { headers: authH(tokA) });
    assert.equal(res.status, 403, 'driver A no puede acceder al POD de B');
  } finally { server.close(); }
});

test('driver A NO puede reordenar las paradas de otros drivers (POST /optimize) — solo las suyas', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    const sA1 = await q.addStop(db, 1, 'Calle A1, Valencia', 'pending', idA);
    const sA2 = await q.addStop(db, 2, 'Calle A2, Valencia', 'pending', idA);
    const sB1 = await q.addStop(db, 3, 'Calle B, Valencia', 'pending', idB);
    const la = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ pin: '1111' }) });
    const { token: tokA } = await la.json();
    // body con paradas propias y coordenadas (evita geocoding de red)
    const ownStops = [
      { id: sA2, address: 'Calle A2, Valencia', driver_id: idA, lat: 39.48, lng: -0.37 },
      { id: sA1, address: 'Calle A1, Valencia', driver_id: idA, lat: 39.49, lng: -0.38 }
    ];
    const res = await fetch(`${base}/api/optimize`, { method: 'POST', headers: { ...jsonHdrs, ...authH(tokA) }, body: JSON.stringify({ origin: { lat: 39.47, lng: -0.38 }, stops: ownStops }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    const ids = body.stops.map((s) => s.id);
    assert.ok(ids.includes(sA1) && ids.includes(sA2), 'las paradas de A se optimizan');
    assert.ok(!ids.includes(sB1), 'la parada de B NO se incluye en la ruta de A');
    const stopB = (await q.listStops(db)).find((s) => s.id === sB1);
    assert.equal(stopB.stop_number, 3, 'el stop_number de B no se toca');
    // body que intenta incluir parada ajena → 403
    const resForbidden = await fetch(`${base}/api/optimize`, { method: 'POST', headers: { ...jsonHdrs, ...authH(tokA) }, body: JSON.stringify({ origin: { lat: 39.47, lng: -0.38 }, stops: [...ownStops, { id: sB1, address: 'Calle B, Valencia', driver_id: idB, lat: 39.5, lng: -0.36 }] }) });
    assert.equal(resForbidden.status, 403, 'rechaza parada ajena en el body');
  } finally { server.close(); }
});

test('verifyToken rechaza tokens firmados SIN expiración (no expira nunca)', () => {
  const secret = 'test-secret';
  // Construir un JWT válido sin campo exp (solo iat)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ role: 'office', iat: Math.floor(Date.now() / 1000) });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const token = `${data}.${sig}`;
  assert.throws(() => verifyToken(token, secret), /exp/i, 'un token sin exp debe rechazarse');
});
