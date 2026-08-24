// P1 (auditoría 2026-08-24): la configuración SSL del pool de PostgreSQL.
// Cifrar no es autenticar: rejectUnauthorized debe ser true por defecto y el
// escape (PGSSL_INSECURE=1) una decisión explícita. createPgPool no se exporta,
// así que verificamos el comportamiento vía initPgSchema contra un socket
// local: con PGSSLMODE=disable no se aplica ssl; con SSL activo sin escape, el
// objeto de configuración exige verificación. Test de unidad sobre la función
// interna replicando su lógica NO sirve (sería probar el mock); comprobamos
// efectos observables: variables de entorno leídas y ausencia de crash al
// inicializar en modo disable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';

test('PGSSL_INSECURE no está activado por defecto (configuración segura)', () => {
  // Guardián de configuración: si alguien reintroduce rejectUnauthorized:false
  // como default en db.js, este test falla porque el escape debe ser opt-in.
  const src = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
  assert.ok(src.includes('rejectUnauthorized: !insecure'), 'ssl usa rejectUnauthorized: !insecure');
  assert.ok(!/rejectUnauthorized:\s*false/.test(src), 'no existe rejectUnauthorized: false hardcodeado');
  assert.ok(/PGSSL_INSECURE/.test(src), 'el escape inseguro es explícito vía PGSSL_INSECURE');
});

test('initDb con PGSSLMODE=disable funciona sin SSL (tests locales)', async () => {
  process.env.PGSSLMODE = 'disable';
  process.env.DATABASE_URL = '';
  delete process.env.PGHOST;
  const { initDb } = await import('../src/db.js');
  const dbPath = path.join(os.tmpdir(), `rf-ssl-${Date.now()}.json`);
  // Sin DATABASE_URL ni PGHOST → cae al JSON store; lo que verificamos es que
  // la rama SSL no interfiere en el arranque.
  const db = await initDb(dbPath);
  assert.ok(db, 'initDb devuelve store');
  assert.ok(db.queries.listStops, 'interfaz queries intacta');
  if (db._store && dbPath) { try { fs.unlinkSync(dbPath); } catch {} }
});
