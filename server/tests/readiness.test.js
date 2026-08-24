// Readiness endpoint: /ready debe reflejar el estado real de la BD, no solo
// del proceso. Regresión: con BD rota, /health sigue 200 pero /ready da 503.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-ready';

function startServer(db) {
  return new Promise(async (resolve) => {
    const app = createServer(db);
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}` });
    });
  });
}

test('/ready devuelve 200 con BD disponible', async () => {
  const db = await initDb(new URL('file:/tmp/rf-ready-ok.json').pathname);
  const { server, base } = await startServer(db);
  try {
    const res = await fetch(`${base}/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ready');
  } finally {
    server.close();
  }
});

test('/ready devuelve 503 cuando la BD falla (y /health sigue 200)', async () => {
  const db = {
    _type: 'json',
    queries: {
      ping: async () => { throw new Error('db down'); },
    },
  };
  const { server, base } = await startServer(db);
  try {
    const bad = await fetch(`${base}/ready`);
    assert.equal(bad.status, 503);
    const body = await bad.json();
    assert.equal(body.status, 'not-ready');

    // Liveness independiente: no depende de la BD
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
  } finally {
    server.close();
  }
});
