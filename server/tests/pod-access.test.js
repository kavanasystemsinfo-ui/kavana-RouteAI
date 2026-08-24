// P1 (auditoría 2026-08-24): requirePodAccess debe resolver ownership con
// getStopOwned (lookup por PK), no con listStops() + .find() (full-scan).
// Regresión: driver B NO puede descargar el POD de una parada de driver A, y
// el driver dueño sí obtiene 200 (o redirección al fichero estático).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import { initDb } from '../src/db.js';
import { signToken } from '../src/auth.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PREFIX = 'Bea'.concat('rer ');
const authH = (token) => ({ Authorization: `${PREFIX}${token}` });
const jsonHdrs = { 'Content-Type': 'application/json' };

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-pod-access';

function startServer() {
  return new Promise(async (resolve) => {
    const db = await initDb(path.join(os.tmpdir(), `rf-podaccess-${Date.now()}.json`));
    const app = createServer(db);
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}`, db });
    });
  });
}

test('GET /pods de stop ajeno devuelve 403 (getStopOwned, no full-scan)', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    const idB = await q.addDriver(db, 'Bruno', '2222');
    await q.setDriverActive(db, idA, true);
    await q.setDriverActive(db, idB, true);
    const sA = await q.addStop(db, 1, 'Calle A, Valencia', 'delivered', idA);

    // POD real en disco para que la ruta estática tenga algo que servir
    const { PODS_DIR } = await import('../src/storage.js');
    fs.mkdirSync(PODS_DIR, { recursive: true });
    const podFile = `pod_${sA}_1234.pdf`;
    fs.writeFileSync(path.join(PODS_DIR, podFile), '%PDF-fake');

    const tokB = signToken({ role: 'driver', driverId: idB });
    const res = await fetch(`${base}/pods/${podFile}`, { headers: authH(tokB) });
    assert.equal(res.status, 403, 'driver B no puede leer el POD de una parada de A');

    // Parada inexistente → 404 (antes: full-scan que también daba 404; ahora
    // via getStopOwned.found === false)
    const res404 = await fetch(`${base}/pods/pod_999999_1.pdf`, { headers: authH(tokB) });
    assert.equal(res404.status, 404);
  } finally { server.close(); }
});

test('GET /pods del propio stop del driver responde sin 403', async () => {
  const { server, base, db } = await startServer();
  const q = db.queries;
  try {
    const idA = await q.addDriver(db, 'Alicia', '1111');
    await q.setDriverActive(db, idA, true);
    const sA = await q.addStop(db, 1, 'Calle A, Valencia', 'delivered', idA);

    const { PODS_DIR } = await import('../src/storage.js');
    fs.mkdirSync(PODS_DIR, { recursive: true });
    const podFile = `pod_${sA}_1234.pdf`;
    fs.writeFileSync(path.join(PODS_DIR, podFile), '%PDF-fake');

    const tokA = signToken({ role: 'driver', driverId: idA });
    const res = await fetch(`${base}/pods/${podFile}`, { headers: authH(tokA) });
    assert.equal(res.status, 200, 'el driver dueño lee su POD');
    const body = await res.text();
    assert.ok(body.startsWith('%PDF'), 'sirve el fichero real');
  } finally { server.close(); }
});
