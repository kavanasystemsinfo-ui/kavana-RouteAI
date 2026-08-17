import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, listPendingMigrations } from '../src/migrations.js';
import { initDb } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

// Fake pool que registra las queries ejecutadas (no toca PostgreSQL real).
function fakePool(initialRows = []) {
  const executed = [];
  const tables = { schema_migrations: initialRows };
  return {
    executed,
    async query(sql, params = []) {
      executed.push({ sql, params });
      // Simular mínimamente: crear tabla y leer versiones aplicadas
      const s = String(sql).trim();
      if (/CREATE TABLE IF NOT EXISTS schema_migrations/.test(s)) {
        tables.schema_migrations = tables.schema_migrations || [];
        return { rows: [] };
      }
      if (/SELECT version FROM schema_migrations/.test(s)) {
        return { rows: tables.schema_migrations };
      }
      if (/INSERT INTO schema_migrations/.test(s)) {
        tables.schema_migrations.push({ version: params[0] });
        return { rows: [] };
      }
      // Cualquier otra query (el contenido del .sql) se registra y no falla
      return { rows: [] };
    },
  };
}

test('listPendingMigrations: detecta migraciones pendientes en orden', async () => {
  const pool = fakePool([{ version: '001' }]);
  const pending = await listPendingMigrations(pool, MIGRATIONS_DIR);
  assert.ok(pending.length >= 1, 'debe haber al menos la migración 001 ya aplicada y otras pendientes');
  // Las pendientes deben estar ordenadas y no incluir la aplicada
  const versions = pending.map((m) => m.version);
  assert.ok(!versions.includes('001'), 'la migración 001 ya está aplicada');
  for (let i = 1; i < versions.length; i++) {
    assert.ok(versions[i] > versions[i - 1], 'las migraciones pendientes van en orden');
  }
});

test('runMigrations: aplica solo las pendientes y registra su versión', async () => {
  const pool = fakePool([{ version: '001' }]);
  const applied = await runMigrations(pool, MIGRATIONS_DIR);
  assert.ok(applied.length >= 1);
  for (const v of applied) {
    assert.ok(pool.executed.some((e) => /INSERT INTO schema_migrations/.test(e.sql) && e.params?.[0] === v),
      `la versión ${v} debe haberse registrado en schema_migrations`);
  }
  // Las migraciones aplicadas no deben reaplicarse en una segunda llamada
  const pool2 = fakePool([{ version: '001' }, ...applied.map((v) => ({ version: v }))]);
  const again = await runMigrations(pool2, MIGRATIONS_DIR);
  assert.equal(again.length, 0, 'no debe reaplicar migraciones ya aplicadas');
});

test('runMigrations: el directorio tiene archivos .sql nombrados version_nombre', () => {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  assert.ok(files.length >= 1, 'debe existir al menos una migración .sql');
  for (const f of files) {
    assert.match(f, /^\d{3}_.+\.sql$/, `nombre de migración debe ser 001_nombre.sql: ${f}`);
  }
});

test('initDb: en producción sin credenciales PG lanza error (no fallback silencioso a JSON)', async () => {
  const prev = { ...process.env };
  try {
    delete process.env.PGHOST;
    delete process.env.DATABASE_URL;
    delete process.env.ROUTEAI_DB;
    process.env.NODE_ENV = 'production';
    await assert.rejects(() => initDb('/tmp/routeai-failfast-test.json'), /NODE_ENV=production/);
  } finally {
    // Restaurar entorno (los borrados fueron sobre el objeto de proceso)
    for (const k of ['PGHOST', 'DATABASE_URL', 'ROUTEAI_DB', 'NODE_ENV']) delete process.env[k];
    Object.assign(process.env, prev);
  }
});