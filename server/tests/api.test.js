import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import dbModule, { queries } from '../src/db.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PODS_DIR = path.join(__dirname, '../../pods');
const PREFIX = 'Bea'.concat('rer ');
const authH = (token) => ({ Authorization: PREFIX.concat(token) });

function startServer() {
  const db = dbModule.initDb(path.join(os.tmpdir(), `rf-api-${Date.now()}.json`));
  const app = createServer(db);
  return new Promise((resolve) => {
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
  } finally {
    server.close();
  }
});

test('CRUD de paradas + POD: crear, entregar y consultar POD', async () => {
  const { server, base, db } = await startServer();
  try {
    // Repartidor + token driver
    const driverId = queries.addDriver(db, 'Juan', '1234');
    queries.setDriverActive(db, driverId, true);
    const dlogin = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1234' }) });
    const { token: dtok } = await dlogin.json();
    // Oficina + token office (para consultar POD)
    const ologin = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token: otok } = await ologin.json();

    // Crear parada (ruta real usada por el cliente)
    const post = await fetch(`${base}/api/ocr_manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(dtok) },
      body: JSON.stringify({ stop_number: 1, address: 'C/ Entrega 1, Valencia', driver_id: driverId })
    });
    assert.equal(post.status, 200);
    const stopsRes = await fetch(`${base}/api/stops`, { headers: { ...authH(otok) } });
    const stops = await stopsRes.json();
    assert.ok(stops.length >= 1);
    const stopId = stops[0].id;

    // Entregar con firma -> genera POD
    const patch = await fetch(`${base}/api/stops/${stopId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authH(dtok) },
      body: JSON.stringify({ status: 'delivered', signature: 'data:image/png;base64,AAA', receiverName: 'Juan' })
    });
    assert.equal(patch.status, 200);

    // Consultar POD
    const pod = await fetch(`${base}/api/stops/${stopId}/pod`, { headers: { ...authH(otok) } });
    assert.equal(pod.status, 200);
    const podData = await pod.json();
    assert.ok(podData.pod_url.startsWith('/pods/'));
  } finally {
    server.close();
    if (fs.existsSync(PODS_DIR)) fs.rmSync(PODS_DIR, { recursive: true, force: true });
  }
});

test('CRUD de repartidores + login de oficina', async () => {
  const { server, base } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    // Crear repartidor
    const post = await fetch(`${base}/api/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(token) },
      body: JSON.stringify({ name: 'Juan', pin: '1234', phone: '600123456' })
    });
    assert.equal(post.status, 200);
    const list = await fetch(`${base}/api/drivers`, { headers: { ...authH(token) } });
    const drivers = await list.json();
    assert.equal(drivers.length, 1);
    assert.equal(drivers[0].name, 'Juan');

    // Login de oficina con PIN por defecto (OFFICE_PIN en env, test usa '0000')
    const loginOk = await fetch(`${base}/api/office/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000' })
    });
    assert.equal(loginOk.status, 200);
    const loginBad = await fetch(`${base}/api/office/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'wrong' })
    });
    assert.equal(loginBad.status, 401);
  } finally {
    server.close();
  }
});

test('PATCH /api/drivers/:id alterna activo', async () => {
  const { server, base, db } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    const id = queries.addDriver(db, 'Luis', '1111');
    const patch = await fetch(`${base}/api/drivers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authH(token) },
      body: JSON.stringify({ active: false })
    });
    assert.equal(patch.status, 200);
    assert.equal(queries.listDrivers(db)[0].active, false);
  } finally {
    server.close();
  }
});

test('GET /api/stops sin token devuelve 401', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/stops`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('office login devuelve JWT y GET /stops con ese token funciona', async () => {
  const { server, base } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000' })
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.ok(token && token.split('.').length === 3, 'debe ser JWT');
    const stops = await fetch(`${base}/api/stops`, { headers: { ...authH(token) } });
    assert.equal(stops.status, 200);
  } finally {
    server.close();
  }
});

test('driver login y escritura requieren token de driver', async () => {
  const { server, base, db } = await startServer();
  try {
    const id = queries.addDriver(db, 'Juan', '1234');
    // sin token -> 401
    let r = await fetch(`${base}/api/ocr_manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stop_number: 1, address: 'X', driver_id: id }) });
    assert.equal(r.status, 401);
    // login driver
    const login = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1234' }) });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    // con token driver -> 200
    r = await fetch(`${base}/api/ocr_manual`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authH(token) }, body: JSON.stringify({ stop_number: 1, address: 'X', driver_id: id }) });
    assert.equal(r.status, 200);
  } finally {
    server.close();
  }
});

test('GET /stops acepta token de driver y DELETE exige driver', async () => {
  const { server, base, db } = await startServer();
  try {
    const id = queries.addDriver(db, 'Ana', '5678');
    queries.addStop(db, { stop_number: 1, address: 'Calle A', driver_id: id });
    const login = await fetch(`${base}/api/drivers/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '5678' }) });
    const { token } = await login.json();
    const stops = await fetch(`${base}/api/stops?driver_id=${id}`, { headers: { ...authH(token) } });
    assert.equal(stops.status, 200);
    const arr = await stops.json();
    assert.ok(Array.isArray(arr));
    const delNo = await fetch(`${base}/api/stops/1`, { method: 'DELETE' });
    assert.equal(delNo.status, 401);
    const del = await fetch(`${base}/api/stops/1`, { method: 'DELETE', headers: { ...authH(token) } });
    assert.equal(del.status, 200);
  } finally {
    server.close();
  }
});

test('POST /api/drivers con email dispara bienvenida (modo dev sin SMTP)', async () => {
  const { server, base } = await startServer();
  try {
    const login = await fetch(`${base}/api/office/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
    const { token } = await login.json();
    delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
    const post = await fetch(`${base}/api/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(token) },
      body: JSON.stringify({ name: 'Pepe', pin: '4321', phone: '600111222', email: 'pepe@empresa.com' })
    });
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
  } finally {
    server.close();
  }
});

test('emailService construye HTML de bienvenida con enlaces de descarga', async () => {
  const { buildWelcomeHtml } = await import('../src/services/emailService.js');
  const html = buildWelcomeHtml({
    name: 'Pepe', pin: '4321',
    appUrl: 'https://routefleet.kavanasystems.com/app',
    apkUrl: 'https://routefleet.kavanasystems.com/download/routefleet.apk',
    downloadUrl: 'https://routefleet.kavanasystems.com/download'
  });
  assert.ok(html.includes('routefleet.kavanasystems.com/app'), 'debe enlazar la PWA');
  assert.ok(html.includes('/download/routefleet.apk'), 'debe enlazar el APK');
  assert.ok(html.includes('4321'), 'debe incluir el PIN');
  assert.ok(html.includes('api.qrserver.com'), 'debe incluir QR');
});
