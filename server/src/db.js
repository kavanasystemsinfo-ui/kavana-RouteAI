// Capa de datos KAVANA Route AI.
// Soporte dual:
//   - PostgreSQL (via DATABASE_URL) — produccion (Supabase/Neon)
//   - JSON file (via ROUTEAI_DB)    — desarrollo local / Render free efimero
//
// Mantiene la MISMA interfaz: initDb() y queries.*
// Si DATABASE_URL existe → usa PG. Si no → usa JSON.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { hashPin } from './pinHash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB = process.env.ROUTEAI_DB || path.join(process.cwd(), 'routeai.json');

// ---------------------------------------------------------------------------
// PostgreSQL adapter
// ---------------------------------------------------------------------------
function createPgPool() {
  // PGSSLMODE=disable permite pruebas locales sin SSL; por defecto SSL activo.
  const sslEnabled = String(process.env.PGSSLMODE || 'require').toLowerCase() !== 'disable';
  // P1: cifrar no es autenticar. Por defecto se
  // verifica el certificado del servidor (rejectUnauthorized: true); el escape
  // PGSSL_INSECURE=1 queda para entornos con CAs propias no confiables y debe
  // ser una decisión explícita, nunca el default silencioso.
  const insecure = String(process.env.PGSSL_INSECURE || '') === '1';
  const ssl = sslEnabled ? { rejectUnauthorized: !insecure } : false;
  // Prioridad 1: Variables individuales PGHOST/PGUSER/PGPASSWORD
  const host = process.env.PGHOST;
  if (host) {
    return new pg.Pool({
      host,
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'neondb_owner',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'neondb',
      ssl,
      family: 4
    });
  }
  // Prioridad 2: DATABASE_URL (connection string completa)
  const url = process.env.DATABASE_URL;
  if (url) {
    return new pg.Pool({ 
      connectionString: url, 
      ssl,
      family: 4
    });
  }
  return null;
}

async function initPgSchema(pool) {
  // El esquema vive en migraciones versionadas (carpeta migrations/): el
  // primer arranque aplica 001 y siguientes; arranques posteriores no hacen
  // nada si ya están aplicadas.
  const { runMigrations } = await import('./migrations.js');
  await runMigrations(pool);
  // Default settings
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km', '0.3']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_hour', '15']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_diesel', '0.30']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_gasolina', '0.35']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_electrico', '0.15']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_hibrido', '0.28']);
}

const pgQueries = {
  // Readiness check: SELECT 1 barato para /ready.
  ping: async (pool) => {
    await pool.query('SELECT 1');
  },
  // Ownership check en BD, no full-scan en JS.
  getStopOwned: async (pool, stopId, driverId) => {
    const res = await pool.query('SELECT * FROM stops WHERE id = $1 LIMIT 1', [stopId]);
    const stop = res.rows[0] || null;
    if (!stop) return { found: false, owned: false, stop: null };
    return { found: true, owned: String(stop.driver_id) === String(driverId), stop };
  },
  listStops: async (pool, filters = {}) => {
    let sql = 'SELECT * FROM stops WHERE 1=1';
    const params = [];
    if (filters.driver_id !== undefined) { params.push(filters.driver_id); sql += ` AND driver_id = $${params.length}`; }
    if (filters.status) { params.push(filters.status); sql += ` AND status = $${params.length}`; }
    if (filters.from) { params.push(filters.from); sql += ` AND created_at >= $${params.length}`; }
    if (filters.to) { params.push(filters.to); sql += ` AND created_at <= $${params.length}`; }
    sql += ' ORDER BY stop_number ASC';
    const res = await pool.query(sql, params);
    // G6: proyección ligera opcional para listados del
    // panel — items JSON puede pesar MB con 12k filas. El detalle completo
    // (con items) lo pide el endpoint de parada individual.
    if (filters.lite) {
      return res.rows.map(({ items, session_id, expira_en, ...rest }) => ({ ...rest }));
    }
    return res.rows;
  },
  addStop: async (pool, stopNumber, address, status = 'pending', driverId = null, items = '', extra = {}) => {
    const res = await pool.query(
      `INSERT INTO stops (stop_number, address, status, driver_id, items, session_id, expira_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [stopNumber, address, status, driverId, items, extra.session_id || '', extra.expira_en || null]
    );
    return res.rows[0].id;
  },
  updateStop: async (pool, id, fields) => {
    // los nombres de columna NUNCA vienen del
    // cliente; whitelist explícita para que un refactor futuro no convierta
    // esto en SQL injection. Rechazar (no ignorar) lo desconocido.
    const ALLOWED_STOP_COLS = new Set([
      'stop_number', 'address', 'status', 'driver_id', 'items', 'signature',
      'receiver_name', 'delivery_notes', 'session_id', 'expira_en',
    ]);
    const set = []; const params = []; let idx = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      if (!ALLOWED_STOP_COLS.has(k)) throw new Error(`updateStop: columna no permitida: ${k}`);
      set.push(`${k} = $${idx++}`); params.push(v);
    }
    if (set.length === 0) return;
    params.push(id);
    await pool.query(`UPDATE stops SET ${set.join(', ')} WHERE id = $${idx}`, params);
  },
  // borrado multi-tabla en transacción. Sin ella,
  // un fallo a mitad deja huérfanos (incidents borrados, stops vivos).
  deleteStop: async (pool, id) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM incidents WHERE stop_id = $1', [id]);
      await client.query('DELETE FROM pods WHERE stop_id = $1', [id]);
      await client.query('DELETE FROM stops WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  clearStops: async (pool) => {
    await pool.query('DELETE FROM incidents');
    await pool.query('DELETE FROM pods');
    await pool.query('DELETE FROM stops');
  },
  addIncident: async (pool, stopId, type, photo, notes) => {
    await pool.query(
      'INSERT INTO incidents (stop_id, type, photo_data, notes) VALUES ($1,$2,$3,$4)',
      [stopId, type, photo || null, notes || '']
    );
  },
  listIncidents: async (pool) => {
    const res = await pool.query('SELECT * FROM incidents ORDER BY created_at DESC');
    return res.rows;
  },
  // sustituye a los 3 listados + find() O(n·m) de
  // /incidents. Una sola query con JOINs y filtro from/to en SQL.
  listIncidentsJoined: async (pool, { from, to } = {}) => {
    let sql = `SELECT i.id, i.stop_id, i.type, i.notes, i.created_at,
                      s.address, s.driver_id, d.name AS driver_name
               FROM incidents i
               LEFT JOIN stops s ON s.id = i.stop_id
               LEFT JOIN drivers d ON d.id = s.driver_id
               WHERE 1=1`;
    const params = [];
    if (from) { params.push(from); sql += ` AND i.created_at >= $${params.length}`; }
    if (to) { params.push(to); sql += ` AND i.created_at <= $${params.length}`; }
    sql += ' ORDER BY i.created_at DESC';
    const res = await pool.query(sql, params);
    return res.rows;
  },
  setSetting: async (pool, key, value) => {
    await pool.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
  },
  getSettings: async (pool) => {
    const res = await pool.query('SELECT key, value FROM settings');
    const obj = {};
    for (const r of res.rows) obj[r.key] = parseFloat(r.value);
    return obj;
  },
  savePod: async (pool, stopId, filePath) => {
    await pool.query('INSERT INTO pods (stop_id, file_path) VALUES ($1,$2) ON CONFLICT (stop_id) DO UPDATE SET file_path = $2', [stopId, filePath]);
  },
  addDriver: async (pool, name, pin, phone = '', email = '', extra = {}) => {
    // P0: PIN nunca en texto plano — scrypt con salt.
    const res = await pool.query(
      `INSERT INTO drivers (name, pin, phone, email, is_demo, session_id, expira_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, hashPin(pin), phone, email, !!extra.is_demo, extra.session_id || '', extra.expira_en || null]
    );
    return res.rows[0].id;
  },
  updateDriverCost: async (pool, id, fuelType, costPerKm) => {
    await pool.query('UPDATE drivers SET fuel_type=$1, cost_per_km=$2 WHERE id=$3', [fuelType || '', costPerKm || 0, id]);
  },
  listDrivers: async (pool) => {
    const res = await pool.query('SELECT * FROM drivers ORDER BY id');
    return res.rows;
  },
  // Deuda 1: login sin cargar toda la tabla. scrypt
  // usa salt por driver, así que no hay lookup determinista por pin; el
  // filtro activo sí baja a SQL y el resto se verifica en JS (pocas filas).
  listActiveDrivers: async (pool) => {
    const res = await pool.query('SELECT * FROM drivers WHERE active = TRUE ORDER BY id');
    return res.rows;
  },
  setDriverActive: async (pool, id, active) => {
    await pool.query('UPDATE drivers SET active = $1 WHERE id = $2', [active, id]);
  },
  getStopPods: async (pool, stopId) => {
    // Busca en pods por stop_id
    const res = await pool.query('SELECT file_path FROM pods WHERE stop_id = $1', [stopId]);
    return res.rows[0] || null;
  },
  startSession: async (pool, driverId, kmInitial) => {
    // P0-3: idempotencia real bajo concurrencia.
    // La migración 005 crea un índice único parcial sobre driver_id WHERE
    // status='active'; ON CONFLICT devuelve la sesión ya activa en vez de
    // duplicarla (dos cron/requests simultáneos = una sola sesión).
    const res = await pool.query(
      `INSERT INTO driver_sessions (driver_id, km_initial, status)
       VALUES ($1,$2,'active')
       ON CONFLICT (driver_id) WHERE status = 'active'
       DO UPDATE SET km_initial = EXCLUDED.km_initial
       RETURNING id, (xmax = 0) AS inserted`,
      [driverId, kmInitial]
    );
    return res.rows[0].id;
  },
  endSession: async (pool, sessionId, kmFinal) => {
    const kmTotal = parseFloat((kmFinal - (await pool.query('SELECT km_initial FROM driver_sessions WHERE id=$1', [sessionId])).rows[0].km_initial).toFixed(3));
    await pool.query(
      'UPDATE driver_sessions SET km_final=$1, km_total=$2, ended_at=NOW(), status=\'closed\' WHERE id=$3',
      [kmFinal, kmTotal, sessionId]
    );
    return kmTotal;
  },
  getActiveSession: async (pool, driverId) => {
    const res = await pool.query('SELECT * FROM driver_sessions WHERE driver_id=$1 AND status=\'active\' ORDER BY id DESC LIMIT 1', [driverId]);
    return res.rows[0] || null;
  },
  listSessions: async (pool, driverId) => {
    const res = await pool.query('SELECT * FROM driver_sessions WHERE driver_id=$1 ORDER BY started_at DESC', [driverId]);
    return res.rows;
  },
  // sustituye al bucle N+1 de /driver/sessions.
  // Una sola query con JOIN + filtro from/to en SQL.
  listSessionsJoined: async (pool, { from, to } = {}) => {
    let sql = `SELECT s.*, d.name AS driver_name
               FROM driver_sessions s JOIN drivers d ON d.id = s.driver_id WHERE 1=1`;
    const params = [];
    if (from) { params.push(from); sql += ` AND s.started_at >= $${params.length}`; }
    if (to) { params.push(to); sql += ` AND s.started_at <= $${params.length}`; }
    sql += ' ORDER BY s.started_at DESC';
    const res = await pool.query(sql, params);
    return res.rows;
  },
  // Limpieza de datos de visitante expirados (cron diario).
  // Borra drivers con expira_en < NOW() y sus paradas/incidencias/pods/sesiones.
  async cleanupExpired(pool) {
    // limpieza multi-tabla atómica.
    const expired = await pool.query(
      `SELECT id FROM drivers WHERE expira_en IS NOT NULL AND expira_en < NOW()`
    );
    const ids = expired.rows.map((r) => r.id);
    if (ids.length === 0) return { deletedDrivers: 0, deletedStops: 0 };
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const stopRes = await pool.query(
      `SELECT id FROM stops WHERE driver_id IN (${placeholders})`, ids
    );
    const stopIds = stopRes.rows.map((r) => r.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (stopIds.length > 0) {
        const sp = stopIds.map((_, i) => `$${i + 1}`).join(',');
        await client.query(`DELETE FROM incidents WHERE stop_id IN (${sp})`, stopIds);
        await client.query(`DELETE FROM pods WHERE stop_id IN (${sp})`, stopIds);
        await client.query(`DELETE FROM stops WHERE id IN (${sp})`, stopIds);
      }
      await client.query(`DELETE FROM driver_sessions WHERE driver_id IN (${placeholders})`, ids);
      await client.query(`DELETE FROM drivers WHERE id IN (${placeholders})`, ids);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return { deletedDrivers: ids.length, deletedStops: stopIds.length };
  },
};

// ---------------------------------------------------------------------------
// JSON adapter (existing)
// ---------------------------------------------------------------------------
function emptyStore() {
  return {
    stops: [], incidents: [], drivers: [],
    settings: { cost_per_km: 0.3, cost_per_hour: 15, cost_per_km_diesel: 0.30, cost_per_km_gasolina: 0.35, cost_per_km_electrico: 0.15, cost_per_km_hibrido: 0.28 },
    pods: {}
  };
}

function load(dbPath) {
  try { const raw = fs.readFileSync(dbPath, 'utf8'); return { ...emptyStore(), ...JSON.parse(raw) }; }
  catch { return emptyStore(); }
}

function persist(dbPath, store) { fs.writeFileSync(dbPath, JSON.stringify(store, null, 2)); }

const jsonQueries = {
  ping: async () => {},
  // Ownership check sin recorrer todo el store dos veces.
  getStopOwned: (db, stopId, driverId) => {
    const stop = db._store.stops.find((s) => String(s.id) === String(stopId)) || null;
    if (!stop) return { found: false, owned: false, stop: null };
    return { found: true, owned: String(stop.driver_id) === String(driverId), stop };
  },
  listStops: (db, filters = {}) => {
    let stops = db._store.stops.slice();
    if (filters.driver_id !== undefined) stops = stops.filter((s) => s.driver_id === filters.driver_id);
    if (filters.status) stops = stops.filter((s) => s.status === filters.status);
    if (filters.from) stops = stops.filter((s) => (s.created_at || '') >= filters.from);
    if (filters.to) stops = stops.filter((s) => (s.created_at || '') <= filters.to);
    stops = stops.sort((a, b) => (a.stop_number || 0) - (b.stop_number || 0));
    // G6: misma proyección lite que el adapter PG.
    if (filters.lite) {
      return stops.map(({ items, session_id, expira_en, ...rest }) => ({ ...rest }));
    }
    return stops;
  },
  addStop: (db, stopNumber, address, status = 'pending', driverId = null, items = '', extra = {}) => {
    const id = db.nextStopId();
    db._store.stops.push({ id, stop_number: stopNumber, address, status, driver_id: driverId, items, created_at: new Date().toISOString(),
      session_id: extra.session_id || '', expira_en: extra.expira_en || null });
    db._save(); return id;
  },
  updateStop: (db, id, fields) => {
    // Misma whitelist que el adapter PG: Object.assign
    // con keys arbitrarias permite prototype pollution vía __proto__.
    const ALLOWED_STOP_COLS = new Set([
      'stop_number', 'address', 'status', 'driver_id', 'items', 'signature',
      'receiver_name', 'delivery_notes', 'session_id', 'expira_en',
    ]);
    for (const k of Object.keys(fields)) {
      if (!ALLOWED_STOP_COLS.has(k)) throw new Error(`updateStop: columna no permitida: ${k}`);
    }
    const stop = db._store.stops.find((s) => s.id === id);
    if (stop) { Object.assign(stop, fields); db._save(); }
  },
  deleteStop: (db, id) => { db._store.stops = db._store.stops.filter((s) => s.id !== id); db._save(); },
  clearStops: (db) => { db._store.stops = []; db._save(); },
  addIncident: (db, stopId, type, photo, notes) => {
    db._store.incidents.push({ id: db._store.incidents.length + 1, stop_id: stopId, type, photo_data: photo || null, notes: notes || '', created_at: new Date().toISOString() });
    db._save();
  },
  listIncidents: (db) => {
    return (db._store.incidents || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  // G6: equivalente JSON de /incidents con JOINs resueltos en memoria.
  listIncidentsJoined: (db, { from, to } = {}) => {
    const f = from ? new Date(from).getTime() : null;
    const t = to ? new Date(to).getTime() : null;
    const stopsById = new Map((db._store.stops || []).map((s) => [s.id, s]));
    const driversById = new Map((db._store.drivers || []).map((d) => [d.id, d.name]));
    return (db._store.incidents || [])
      .filter((inc) => {
        const t0 = inc.created_at ? new Date(inc.created_at).getTime() : null;
        if (f !== null && (t0 === null || t0 < f)) return false;
        if (t !== null && (t0 === null || t0 > t)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((inc) => {
        const stop = stopsById.get(inc.stop_id);
        return {
          id: inc.id, stop_id: inc.stop_id, type: inc.type, notes: inc.notes,
          created_at: inc.created_at,
          address: stop?.address ?? null,
          driver_id: stop?.driver_id ?? null,
          driver_name: stop ? driversById.get(stop.driver_id) ?? null : null,
        };
      });
  },
  setSetting: (db, key, value) => { db._store.settings[key] = parseFloat(value); db._save(); },
  getSettings: (db) => ({ ...db._store.settings }),
  savePod: (db, stopId, filePath) => { db._store.pods[stopId] = filePath; db._save(); },
  addDriver: (db, name, pin, phone = '', email = '', extra = {}) => {
    // P0: PIN hasheado también en el store JSON.
    const id = (db._store.drivers.reduce((m, d) => Math.max(m, d.id || 0), 0)) + 1;
    db._store.drivers.push({ id, name, pin: hashPin(pin), phone, email: email || '', active: true, fuel_type: '', cost_per_km: 0,
      is_demo: !!extra.is_demo, session_id: extra.session_id || '', expira_en: extra.expira_en || null });
    db._save(); return id;
  },
  updateDriverCost: (db, id, fuelType, costPerKm) => {
    const d = db._store.drivers.find((x) => x.id === id);
    if (d) { d.fuel_type = fuelType || ''; d.cost_per_km = costPerKm || 0; db._save(); }
  },
  listDrivers: (db) => db._store.drivers.slice(),
  // Deuda 1: login filtra activos en el adapter.
  listActiveDrivers: (db) => db._store.drivers.filter((d) => d.active),
  setDriverActive: (db, id, active) => {
    const d = db._store.drivers.find((x) => x.id === id);
    if (d) { d.active = active; db._save(); }
  },
  getStopPods: (db, stopId) => {
    const path = db._store.pods[stopId];
    return path ? { file_path: path } : null;
  },
  startSession: (db, driverId, kmInitial) => {
    const sessions = db._store.sessions || [];
    // P0-3: idempotente — si ya hay sesión activa del driver, se reutiliza.
    const existing = sessions.find((s) => s.driver_id === driverId && s.status === 'active');
    if (existing) return existing.id;
    const id = sessions.length + 1;
    sessions.push({ id, driver_id: driverId, km_initial: kmInitial, km_final: null, km_total: null, date: new Date().toISOString().slice(0,10), started_at: new Date().toISOString(), ended_at: null, status: 'active' });
    db._store.sessions = sessions; db._save(); return id;
  },
  endSession: (db, sessionId, kmFinal) => {
    const session = (db._store.sessions || []).find(s => s.id === sessionId);
    if (!session) throw new Error('Sesión no encontrada');
    session.km_final = kmFinal;
    session.km_total = parseFloat((kmFinal - session.km_initial).toFixed(3));
    session.ended_at = new Date().toISOString();
    session.status = 'closed';
    db._save(); return session.km_total;
  },
  getActiveSession: (db, driverId) => {
    return (db._store.sessions || []).filter(s => s.driver_id === driverId && s.status === 'active').sort((a,b) => b.id - a.id)[0] || null;
  },
  listSessions: (db, driverId) => {
    return (db._store.sessions || []).filter(s => s.driver_id === driverId).sort((a,b) => b.started_at.localeCompare(a.started_at));
  },
  // G6: equivalente JSON del JOIN de /driver/sessions (mismo contrato).
  listSessionsJoined: (db, { from, to } = {}) => {
    const f = from ? new Date(from).getTime() : null;
    const t = to ? new Date(to).getTime() : null;
    const driversById = new Map((db._store.drivers || []).map((d) => [d.id, d.name]));
    return (db._store.sessions || [])
      .filter((s) => {
        const t0 = s.started_at ? new Date(s.started_at).getTime() : null;
        if (f !== null && (t0 === null || t0 < f)) return false;
        if (t !== null && (t0 === null || t0 > t)) return false;
        return true;
      })
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
      .map((s) => ({ ...s, driver_name: driversById.get(s.driver_id) || '—' }));
  },
  cleanupExpired: (db) => {
    const now = new Date().toISOString();
    const expired = (db._store.drivers || []).filter(d => d.expira_en && new Date(d.expira_en) < new Date(now));
    const ids = new Set(expired.map(d => d.id));
    if (ids.size === 0) return { deletedDrivers: 0, deletedStops: 0 };
    const beforeStops = (db._store.stops || []).length;
    db._store.stops = (db._store.stops || []).filter(s => !ids.has(s.driver_id));
    const deletedStops = beforeStops - db._store.stops.length;
    // Limpiar incidents/pods/sessions cuyas paradas o drivers ya no existen
    const stopIds = new Set(db._store.stops.map(s => s.id));
    db._store.incidents = (db._store.incidents || []).filter(i => stopIds.has(i.stop_id));
    db._store.pods = Object.fromEntries(Object.entries(db._store.pods || {}).filter(([k]) => stopIds.has(Number(k))));
    db._store.sessions = (db._store.sessions || []).filter(s => !ids.has(s.driver_id));
    db._store.drivers = (db._store.drivers || []).filter(d => !ids.has(d.id));
    db._save();
    return { deletedDrivers: ids.size, deletedStops };
  }
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export async function initDb(dbPath = DEFAULT_DB) {
  // 1) Try PostgreSQL if DATABASE_URL is set
  const pgPool = createPgPool();
  if (pgPool) {
    await initPgSchema(pgPool);
    console.log('[db] PostgreSQL activo (connected via DATABASE_URL)');
    // Wrap pgQueries functions to auto-extract pool from db parameter
    const wrapped = {};
    for (const [name, fn] of Object.entries(pgQueries)) {
      wrapped[name] = (db, ...args) => fn(db._pool, ...args);
    }
    return {
      _type: 'pg',
      _pool: pgPool,
      queries: wrapped,
      nextStopId: async (db) => { const r = await pgPool.query('SELECT COALESCE(MAX(id),0)+1 AS n FROM stops'); return r.rows[0].n; }
    };
  }

  // 2) Producción SIN PostgreSQL = error, no fallback silencioso (Fase 3):
  //    un JSON file en el FS efímero de Fly/Render simularía que todo funciona
  //    y perdería los datos en el siguiente deploy. Fallar es lo correcto.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[db] NODE_ENV=production pero faltan credenciales PostgreSQL (PGHOST o DATABASE_URL). La API no arranca sin BD real en producción.');
  }

  // 3) Fallback JSON file (solo desarrollo local)
  const store = load(dbPath);
  if (typeof store.settings.cost_per_km !== 'number') store.settings.cost_per_km = 0.3;
  if (typeof store.settings.cost_per_hour !== 'number') store.settings.cost_per_hour = 15;
  if (typeof store.settings.cost_per_km_diesel !== 'number') store.settings.cost_per_km_diesel = 0.30;
  if (typeof store.settings.cost_per_km_gasolina !== 'number') store.settings.cost_per_km_gasolina = 0.35;
  if (typeof store.settings.cost_per_km_electrico !== 'number') store.settings.cost_per_km_electrico = 0.15;
  if (typeof store.settings.cost_per_km_hibrido !== 'number') store.settings.cost_per_km_hibrido = 0.28;
  persist(dbPath, store);

  console.log(`[db] JSON store en ${dbPath}`);
  return {
    _type: 'json',
    _path: dbPath,
    _store: store,
    _save() { persist(this._path, this._store); },
    queries: jsonQueries,
    nextStopId() {
      const max = store.stops.reduce((m, s) => Math.max(m, s.id || 0), 0);
      return max + 1;
    }
  };
}

// Export static queries for legacy test compatibility
export { jsonQueries as queries, pgQueries };
export default { initDb, queries: jsonQueries, pgQueries };
