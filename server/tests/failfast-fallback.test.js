// Regresión: el fallback JSON NUNCA puede activarse en producción ni sin
// STORAGE_MODE=json explícito (auditoría 2026-08-23, hallazgo P0-2).
// El bloque de arranque vive en index.js dentro de un if de entry-point,
// así que verificamos ejecutándolo como proceso real con PG imposible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(__dirname, '../src/index.js');

function childEnv(extra) {
  // Entorno limpio: sin credenciales PG heredadas del runner.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    ...extra,
    PGHOST: 'no-existe-host-invalido',
    PGPORT: '59999',
    PGPASSWORD: 'x',
    PGUSER: 'x',
    PGDATABASE: 'x',
  };
  for (const k of ['DATABASE_URL', 'STORAGE_MODE', 'NODE_ENV', 'OFFICE_PIN', 'JWT_SECRET', 'PORT']) delete env[k];
  Object.assign(env, extra);
  return env;
}

function runIndex(extra, { expectServer = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', [INDEX], { env: childEnv(extra), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch {}
      resolve(result);
    };
    const collect = (d) => { out += d; };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    if (expectServer) {
      // Si aparece "JSON store"/"JSON fallback" + "API en puerto", arrancó OK.
      const timer = setInterval(() => {
        if (/API en puerto/.test(out)) {
          clearInterval(timer);
          finish({ code: 0, out });
        }
      }, 200);
      setTimeout(() => { clearInterval(timer); finish({ code: 1, out }); }, 20000);
    } else {
      child.on('exit', (code) => finish({ code, out }));
      setTimeout(() => finish({ code: -1, out }), 30000);
    }
  });
}

test('producción + PG caído = fail-fast (exit 1), nunca JSON fallback', async () => {
  const r = await runIndex({ NODE_ENV: 'production', OFFICE_PIN: '9172', JWT_SECRET: 'secreto-real-de-produccion' });
  assert.equal(r.code, 1);
  assert.match(r.out, /fallback JSON/);
});

test('desarrollo sin STORAGE_MODE=json también falla (opt-in requerido)', async () => {
  const r = await runIndex({ NODE_ENV: 'development', OFFICE_PIN: '0000', JWT_SECRET: 'routeai-dev-secret-change-me' });
  assert.equal(r.code, 1);
  assert.match(r.out, /fallback JSON/);
});

test('desarrollo + STORAGE_MODE=json permite fallback y arranca', async () => {
  const r = await runIndex({
    NODE_ENV: 'development',
    STORAGE_MODE: 'json',
    PORT: '59901',
    OFFICE_PIN: '0000',
    JWT_SECRET: 'routeai-dev-secret-change-me',
  }, { expectServer: true });
  assert.equal(r.code, 0);
  assert.match(r.out, /JSON fallback|JSON store/);
});
