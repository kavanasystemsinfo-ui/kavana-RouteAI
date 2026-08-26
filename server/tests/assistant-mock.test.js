// P1 (auditoría 2026-08-24): el test de integración del asistente debe aislar
// la dependencia externa con un mock del proveedor, no aceptar "200 o 500"
// según el entorno. Dos comportamientos separados:
//   1. provider mockeado OK  → 200 con respuesta determinista
//   2. provider caído (500)  → 500 con error explícito
// El mock sustituye globalThis.fetch SOLO para openrouter.ai; las llamadas al
// servidor local pasan por el fetch real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import { cargarCorpus } from '../src/services/assistantService.js';
import os from 'os';
import path from 'path';

const jsonHdrs = { 'Content-Type': 'application/json' };

function startServer() {
  return new Promise(async (resolve) => {
    const db = await initDb(path.join(os.tmpdir(), `rf-assist-${Date.now()}.json`));
    const app = createServer(db);
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}` });
    });
  });
}

const realFetch = globalThis.fetch;
const esOpenRouter = (url) => String(url).includes('openrouter.ai');

test('POST /assistant con provider mockeado responde 200 determinista', async () => {
  process.env.OPENROUTER_API_KEY = 'test-key-mock';
  let llamadas = 0;
  globalThis.fetch = async (url, opts = {}) => {
    if (!esOpenRouter(url)) return realFetch(url, opts);
    llamadas++;
    const body = JSON.parse(opts.body);
    assert.ok(body.model, 'el body incluye modelo');
    assert.ok(body.messages.some((m) => m.role === 'system'), 'incluye system prompt RAG');
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'RESPUESTA_MOCK_DETERMINISTA' } }] }),
    };
  };
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/assistant`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ question: '¿Cómo funciona el POD de Route AI?' }) });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.respuesta, 'RESPUESTA_MOCK_DETERMINISTA');
    assert.ok(Array.isArray(data.fuentes) && data.fuentes.length > 0, 'cita fuentes del corpus');
    assert.ok(data.modelo, 'indica el modelo usado');
    assert.ok(llamadas >= 1, 'se llamó al provider exactamente vía llamarOpenRouter');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENROUTER_API_KEY;
    server.close();
  }
});

test('POST /assistant con provider caído devuelve 500 y no inventa', async () => {
  process.env.OPENROUTER_API_KEY = 'test-key-mock';
  globalThis.fetch = async (url, opts = {}) => {
    if (!esOpenRouter(url)) return realFetch(url, opts);
    return { ok: false, status: 503, text: async () => 'provider down' };
  };
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/assistant`, { method: 'POST', headers: jsonHdrs, body: JSON.stringify({ question: '¿Cómo funciona el POD de Route AI?' }) });
    assert.equal(res.status, 500, 'fallo del provider se traduce en 500');
    const data = await res.json();
    assert.ok(!('respuesta' in data) || !data.respuesta, 'sin respuesta inventada');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENROUTER_API_KEY;
    server.close();
  }
});

test('el corpus no indexa plantillas', () => {
  const fuentes = new Set(cargarCorpus().map((c) => c.fuente));
  assert.ok(![...fuentes].some((f) => f.toLowerCase().includes('template')));
});
