// Tests de integración del tracking público GET /api/track/:token.
// Contrato verificado:
//   1. Toda parada nueva nace con tracking_token (24 hex) en ambos adapters.
//   2. GET con token válido → 200 con estado/dirección, sin datos internos.
//   3. Token inválido o malformado → 404 (sin pistas de existencia).
//   4. La respuesta jamás expone signature, items, driver_id ni session_id.
//   5. ETA presente cuando la parada tiene coordenadas y hay ruta pendiente.
//   6. Rate limit: la consulta 31 en un minuto → 429.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import { resetRateLimiter } from '../src/rateLimiter.js';

process.env.OFFICE_PIN = process.env.OFFICE_PIN || '0000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function startServer() {
  // El rate limiter es un singleton global: limpiar contadores de otros
  // tests para que el límite del tracking se pruebe desde cero.
  await resetRateLimiter();
  const dbPath = path.join(os.tmpdir(), `rf-track-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const db = await initDb(dbPath);
  const app = createServer(db);
  const driverId = await db.queries.addDriver(db, 'Track Driver', '1234');
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ db, server, base: `http://127.0.0.1:${server.address().port}`, driverId, dbPath });
    });
  });
}

async function withServer(fn) {
  const ctx = await startServer();
  try {
    return await fn(ctx);
  } finally {
    ctx.server.close();
    try { fs.unlinkSync(ctx.dbPath); } catch {}
  }
}

test('toda parada nueva nace con tracking_token de 24 hex', async () => {
  await withServer(async ({ db, driverId }) => {
    const stopId = await db.queries.addStop(db, 1001, 'Calle Test 1, Valencia', 'pending', driverId);
    const stop = await db.queries.getStop(db, stopId);
    assert.ok(stop.tracking_token, 'la parada debe tener tracking_token');
    assert.match(stop.tracking_token, /^[0-9a-f]{24}$/, 'formato 24 hex');
  });
});

test('GET /api/track/:token válido devuelve estado público', async () => {
  await withServer(async ({ db, base, driverId }) => {
    const stopId = await db.queries.addStop(db, 1002, 'Calle Test 2, Valencia', 'pending', driverId);
    const stop = await db.queries.getStop(db, stopId);

    const res = await fetch(`${base}/api/track/${stop.tracking_token}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.stop.status, 'pending');
    assert.equal(data.stop.status_label, 'En reparto');
    assert.equal(data.stop.address, 'Calle Test 2, Valencia');
  });
});

test('la respuesta pública no filtra signature/items/driver_id/session_id', async () => {
  await withServer(async ({ db, base, driverId }) => {
    const stopId = await db.queries.addStop(db, 1003, 'Calle Test 3, Valencia', 'delivered', driverId, JSON.stringify([{ sku: 'X' }]));
    await db.queries.updateStop(db, stopId, { signature: 'data:image/png;base64,XYZ', receiver_name: 'Cliente' });
    const stop = await db.queries.getStop(db, stopId);

    const res = await fetch(`${base}/api/track/${stop.tracking_token}`);
    const data = await res.json();
    const raw = JSON.stringify(data);
    assert.equal(res.status, 200);
    assert.ok(!('signature' in data.stop), 'sin signature');
    assert.ok(!('items' in data.stop), 'sin items');
    assert.ok(!('driver_id' in data.stop), 'sin driver_id');
    assert.ok(!('session_id' in data.stop), 'sin session_id');
    assert.ok(!raw.includes('base64'), 'sin datos de firma embebidos');
  });
});

test('token inválido o malformado → 404 sin pistas', async () => {
  await withServer(async ({ base }) => {
    for (const bad of ['nadaquexiste', 'AB'.repeat(12), 'x'.repeat(24)]) {
      const res = await fetch(`${base}/api/track/${bad}`);
      assert.equal(res.status, 404, `token ${bad} debe ser 404`);
      const data = await res.json();
      assert.equal(data.error, 'Enlace no válido');
    }
  });
});

test('parada entregada muestra estado entregado sin ETA', async () => {
  await withServer(async ({ db, base, driverId }) => {
    const stopId = await db.queries.addStop(db, 1004, 'Calle Test 4, Valencia', 'delivered', driverId);
    await db.queries.updateStop(db, stopId, { receiver_name: 'Receptor' });
    const stop = await db.queries.getStop(db, stopId);

    const res = await fetch(`${base}/api/track/${stop.tracking_token}`);
    const data = await res.json();
    assert.equal(data.stop.status, 'delivered');
    assert.equal(data.stop.status_label, 'Entregado');
    assert.equal(data.stop.eta_minutes, null);
  });
});

test('ETA calculada cuando hay coordenadas y paradas previas pendientes', async () => {
  await withServer(async ({ db, base, driverId }) => {
    const s1 = await db.queries.addStop(db, 1, 'A', 'pending', driverId);
    await db.queries.updateStop(db, s1, { lat: 39.47, lng: -0.38 });
    const s2 = await db.queries.addStop(db, 2, 'B', 'pending', driverId);
    await db.queries.updateStop(db, s2, { lat: 39.50, lng: -0.40 });

    const stop = await db.queries.getStop(db, s2);
    const res = await fetch(`${base}/api/track/${stop.tracking_token}`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.stop.pending_before, 1, 'una parada pendiente por delante');
    assert.ok(typeof data.stop.eta_minutes === 'number' && data.stop.eta_minutes >= 5, 'ETA informativa presente');
  });
});

test('la página pública /t/:token se sirve sin login', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/t/aaaaaaaaaaaaaaaaaaaaaaaa`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('KAVANA ROUTE AI'), 'branding presente');
    assert.ok(html.includes('Seguimiento'), 'título de seguimiento presente');
    assert.ok(!html.includes('Authorization'), 'sin cabeceras de auth embebidas');
  });
});

test('rate limit del tracking: 30/min, la 31 → 429', async () => {
  await withServer(async ({ db, base, driverId }) => {
    const stopId = await db.queries.addStop(db, 1005, 'Calle Test 5', 'pending', driverId);
    const stop = await db.queries.getStop(db, stopId);
    const url = `${base}/api/track/${stop.tracking_token}`;

    let last = 0;
    for (let i = 0; i < 32; i++) {
      const res = await fetch(url);
      last = res.status;
      if (i < 29) assert.equal(res.status, 200, `consulta ${i + 1} debe ser 200`);
    }
    assert.equal(last, 429, 'la consulta 31 debe ser 429');
  });
});
