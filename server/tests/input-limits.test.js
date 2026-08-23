// Regresión P1 (auditoría 2026-08-23): límites de superficie de entrada.
// /stops/bulk máx 100 direcciones; foto base64 máx 5 MB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, queries } from '../src/db.js';
import { createServer } from '../src/index.js';
import os from 'os';
import path from 'path';

async function freshServer() {
  const file = path.join(os.tmpdir(), `rf-lim-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const db = await initDb(file);
  const app = createServer(db);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}`, q: queries, db });
    });
  });
}

async function officeToken(base) {
  const login = await fetch(`${base}/api/office/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '0000' }),
  });
  const data = await login.json();
  return data.token;
}

test('/stops/bulk rechaza >100 direcciones con 413', async () => {
  const { server, base } = await freshServer();
  try {
    const token = await officeToken(base);
    const addresses = Array.from({ length: 101 }, (_, i) => `C/ Falsa ${i}`);
    const res = await fetch(`${base}/api/stops/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ addresses }),
    });
    assert.equal(res.status, 413);
  } finally { server.close(); }
});

test('/stops/bulk acepta exactamente 100', async () => {
  const { server, base } = await freshServer();
  try {
    const token = await officeToken(base);
    const addresses = Array.from({ length: 100 }, (_, i) => `C/ Límite ${i}`);
    const res = await fetch(`${base}/api/stops/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ addresses }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 100);
  } finally { server.close(); }
});
