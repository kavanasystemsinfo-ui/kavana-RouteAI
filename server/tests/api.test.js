import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import dbModule from '../src/db.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PODS_DIR = path.join(__dirname, '../../pods');

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
    const res = await fetch(`${base}/api/settings`);
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
    // Crear parada (ruta real usada por el cliente)
    const post = await fetch(`${base}/api/ocr_manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stop_number: 1, address: 'C/ Entrega 1, Valencia' })
    });
    assert.equal(post.status, 200);
    const stopsRes = await fetch(`${base}/api/stops`);
    const stops = await stopsRes.json();
    assert.ok(stops.length >= 1);
    const stopId = stops[0].id;

    // Entregar con firma -> genera POD
    const patch = await fetch(`${base}/api/stops/${stopId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered', signature: 'data:image/png;base64,AAA', receiverName: 'Juan' })
    });
    assert.equal(patch.status, 200);

    // Consultar POD
    const pod = await fetch(`${base}/api/stops/${stopId}/pod`);
    assert.equal(pod.status, 200);
    const podData = await pod.json();
    assert.ok(podData.pod_url.startsWith('/pods/'));
  } finally {
    server.close();
    if (fs.existsSync(PODS_DIR)) fs.rmSync(PODS_DIR, { recursive: true, force: true });
  }
});
