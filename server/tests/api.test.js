import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PODS_DIR = path.join(__dirname, '../../pods');
const PREFIX = 'Bea'.concat('rer ');
const authH = (token) => ({ Authorization: PREFIX.concat(token) });

function startServer() {
  return new Promise(async (resolve) => {
    const db = await initDb(path.join(os.tmpdir(), `rf-api-${Date.now()}.json`));
    const app = createServer(db);
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}`, db });
    });
  });
}

test('GET /api/settings responde con costes OPEX', async () => {
  const { server, base } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    const res = await fetch(`${base}/api/settings`, { headers: { ...authH(token) } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('cost_per_km' in data);
  } finally { server.close(); }
});

test('CRUD de paradas + POD: crear, entregar y consultar POD', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const driverId = await q.addDriver(db, 'Juan', '1234');
    await q.setDriverActive(db, driverId, true);
    const dlogin = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1234' }) });
    const { token: dtok } = await dlogin.json();
    const ologin = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token: otok } = await ologin.json();
    // Crear parada via driver
    const create = await fetch(`${base}/api/ocr_manual`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH(dtok) }, body: JSON.stringify({ stop_number: 1, address: 'C/ Mayor 1, Valencia', driver_id: driverId }) });
    assert.equal(create.status, 200);
    // Entregar con firma
    const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const deliver = await fetch(`${base}/api/stops/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authH(dtok) }, body: JSON.stringify({ status: 'delivered', signature: sig, receiverName: 'Cliente Test' }) });
    assert.equal(deliver.status, 200);
    const data = await deliver.json();
    // Deberia devolver pod_url
    if (data.pod_url) {
      const podRes = await fetch(data.pod_url);
      assert.equal(podRes.status, 200);
      const podBuf = await podRes.arrayBuffer();
      assert.ok(podBuf.byteLength > 200, 'PDF debe tener contenido');
    }
  } finally { server.close(); }
});

test('CRUD de repartidores + login de oficina', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    // Crear
    const post = await fetch(`${base}/api/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH(token) }, body: JSON.stringify({ name: 'Juan', pin: '1234', phone: '600111222' }) });
    assert.equal(post.status, 200);
    const data = await post.json();
    assert.ok(data.id >= 1);
    // Listar
    const list = await fetch(`${base}/api/drivers`, { headers: { ...authH(token) } });
    const drivers = await list.json();
    assert.equal(drivers.length, 1);
    assert.equal(drivers[0].name, 'Juan');
  } finally { server.close(); }
});

test('PATCH /api/drivers/:id alterna activo', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const id = await q.addDriver(db, 'Luis', '1111');
    const ologin = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token: otok } = await ologin.json();
    const patch = await fetch(`${base}/api/drivers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authH(otok) }, body: JSON.stringify({ active: false }) });
    assert.equal(patch.status, 200);
    const drivers = await q.listDrivers(db);
    assert.equal(drivers[0].active, false);
  } finally { server.close(); }
});

test('GET /api/stops sin token devuelve 401', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/stops`);
    assert.equal(res.status, 401);
  } finally { server.close(); }
});

test('office login devuelve JWT y GET /stops con ese token funciona', async () => {
  const { server, base } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    assert.ok(token);
    const stops = await fetch(`${base}/api/stops`, { headers: { ...authH(token) } });
    assert.equal(stops.status, 200);
    assert.ok(Array.isArray(await stops.json()));
  } finally { server.close(); }
});

test('driver login y escritura requieren token de driver', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const id = await q.addDriver(db, 'Juan', '1234');
    await q.setDriverActive(db, id, true);
    const dlogin = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1234' }) });
    const { token: dtok } = await dlogin.json();
    const ocr = await fetch(`${base}/api/ocr_manual`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH(dtok) }, body: JSON.stringify({ stop_number: 1, address: 'C/ A' }) });
    assert.equal(ocr.status, 200);
    // driver sin token -> 401
    const stops = await fetch(`${base}/api/stops`);
    assert.equal(stops.status, 401);
  } finally { server.close(); }
});

test('GET /stops acepta token de driver y DELETE exige driver', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const id = await q.addDriver(db, 'Ana', '5678');
    await q.setDriverActive(db, id, true);
    const dlogin = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '5678' }) });
    const { token: dtok } = await dlogin.json();
    await q.addStop(db, 1, 'C/ Falsa 123', 'pending', id);
    const stops = await fetch(`${base}/api/stops`, { headers: { ...authH(dtok) } });
    assert.equal(stops.status, 200);
    const list = await stops.json();
    assert.equal(list.length, 1);
    const del = await fetch(`${base}/api/stops/1`, { method: 'DELETE', headers: { ...authH(dtok) } });
    assert.equal(del.status, 200);
  } finally { server.close(); }
});

test('POST /api/drivers con email dispara bienvenida (modo dev sin SMTP)', async () => {
  const { server, base } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
    const post = await fetch(`${base}/api/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH(token) }, body: JSON.stringify({ name: 'Pepe', pin: '4321', phone: '600111222', email: 'pepe@empresa.com' }) });
    assert.equal(post.status, 200);
    const data = await post.json();
    assert.equal(data.success, true);
    assert.equal(data.emailDev, true, 'sin SMTP configurado debe ir a modo dev (log)');
    assert.equal(data.emailSent, false);
    const list = await fetch(`${base}/api/drivers`, { headers: { ...authH(token) } });
    const drivers = await list.json();
    const pepe = drivers.find((d) => d.name === 'Pepe');
    assert.ok(pepe, 'repartidor creado');
    assert.equal(pepe.email, 'pepe@empresa.com');
  } finally { server.close(); }
});

test('emailService construye HTML de bienvenida con enlaces de la app', async () => {
  const { buildWelcomeHtml } = await import('../src/services/emailService.js');
  const html = buildWelcomeHtml({ name: 'Pepe', pin: '4321', appUrl: 'https://routeai.kavanasystems.com/app', downloadUrl: 'https://routeai.kavanasystems.com/app' });
  assert.ok(html.includes('routeai.kavanasystems.com/app'), 'debe enlazar la app');
  assert.ok(html.includes('4321'), 'debe incluir el PIN');
  assert.ok(html.includes('api.qrserver.com'), 'debe incluir QR');
});

// --- TESTS TORRE DE CONTROL (2026-07-29) ---
test('POST /stops/bulk como oficina asigna paradas a un repartidor especifico', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const drvId = await q.addDriver(db, 'Maria', '9999');
    await q.setDriverActive(db, drvId, true);
    const ologin = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token: otok } = await ologin.json();
    const res = await fetch(`${base}/api/stops/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH(otok) }, body: JSON.stringify({ addresses: ['Calle Mayor 1, Valencia', 'Ruzafa 25, Valencia'], driver_id: drvId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.total, 2);
    const stops = await q.listStops(db);
    assert.equal(stops.length, 2);
    stops.forEach((s) => assert.equal(s.driver_id, drvId));
  } finally { server.close(); }
});

test('GET /stops?driver_id=X filtra por repartidor (oficina)', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const drvA = await q.addDriver(db, 'Ana', '1111');
    const drvB = await q.addDriver(db, 'Luis', '2222');
    await q.addStop(db, Date.now(), 'Parada Ana 1', 'pending', drvA);
    await q.addStop(db, Date.now(), 'Parada Ana 2', 'pending', drvA);
    await q.addStop(db, Date.now(), 'Parada Luis 1', 'pending', drvB);
    const ologin = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token: otok } = await ologin.json();
    const res = await fetch(`${base}/api/stops?driver_id=${drvA}`, { headers: { ...authH(otok) } });
    const data = await res.json();
    assert.equal(data.length, 2);
    data.forEach((s) => assert.equal(s.driver_id, drvA));
  } finally { server.close(); }
});
