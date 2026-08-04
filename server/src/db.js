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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB = process.env.ROUTEAI_DB || path.join(process.cwd(), 'routeai.json');

// ---------------------------------------------------------------------------
// SCHEMA SQL (PostgreSQL)
// ---------------------------------------------------------------------------
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  stop_number BIGINT NOT NULL,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  driver_id INTEGER REFERENCES drivers(id),
  signature TEXT,
  receiver_name TEXT,
  distance TEXT,
  estimated_time TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE stops ALTER COLUMN stop_number TYPE BIGINT;

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  type TEXT,
  photo_data TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pods (
  stop_id INTEGER PRIMARY KEY REFERENCES stops(id),
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_sessions (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id),
  km_initial NUMERIC(10,1),
  km_final NUMERIC(10,1),
  km_total NUMERIC(10,1),
  date DATE DEFAULT CURRENT_DATE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  status TEXT DEFAULT 'active'
);

-- Migración: añadir columnas de coste por vehículo (si no existen)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT '';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cost_per_km NUMERIC(10,2) DEFAULT 0;
`;

// ---------------------------------------------------------------------------
// POSTGRESQL adapter
// ---------------------------------------------------------------------------
function createPgPool() {
  // Prioridad 1: Variables individuales PGHOST/PGUSER/PGPASSWORD
  const host = process.env.PGHOST;
  if (host) {
    return new pg.Pool({
      host,
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'neondb_owner',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'neondb',
      ssl: { rejectUnauthorized: false },
      family: 4
    });
  }
  // Prioridad 2: DATABASE_URL (connection string completa)
  const url = process.env.DATABASE_URL;
  if (url) {
    return new pg.Pool({ 
      connectionString: url, 
      ssl: { rejectUnauthorized: false },
      family: 4
    });
  }
  return null;
}

async function initPgSchema(pool) {
  await pool.query(SCHEMA_SQL).catch(e => { console.warn('[db] Schema warning (no fatal):', e.message); });
  // Default settings
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km', '0.3']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_hour', '15']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_diesel', '0.30']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_gasolina', '0.35']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_electrico', '0.15']);
  await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['cost_per_km_hibrido', '0.28']);
}

const pgQueries = {
  listStops: async (pool, filters = {}) => {
    let sql = 'SELECT * FROM stops WHERE 1=1';
    const params = [];
    if (filters.driver_id !== undefined) { params.push(filters.driver_id); sql += ` AND driver_id = $${params.length}`; }
    if (filters.status) { params.push(filters.status); sql += ` AND status = $${params.length}`; }
    if (filters.from) { params.push(filters.from); sql += ` AND created_at >= $${params.length}`; }
    if (filters.to) { params.push(filters.to); sql += ` AND created_at <= $${params.length}`; }
    sql += ' ORDER BY stop_number ASC';
    const res = await pool.query(sql, params);
    return res.rows;
  },
  addStop: async (pool, stopNumber, address, status = 'pending', driverId = null) => {
    const res = await pool.query(
      'INSERT INTO stops (stop_number, address, status, driver_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [stopNumber, address, status, driverId]
    );
    return res.rows[0].id;
  },
  updateStop: async (pool, id, fields) => {
    const set = []; const params = []; let idx = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) { set.push(`${k} = $${idx++}`); params.push(v); }
    }
    if (set.length === 0) return;
    params.push(id);
    await pool.query(`UPDATE stops SET ${set.join(', ')} WHERE id = $${idx}`, params);
  },
  deleteStop: async (pool, id) => { await pool.query('DELETE FROM stops WHERE id = $1', [id]); },
  clearStops: async (pool) => { await pool.query('DELETE FROM stops'); },
  addIncident: async (pool, stopId, type, photo, notes) => {
    await pool.query(
      'INSERT INTO incidents (stop_id, type, photo_data, notes) VALUES ($1,$2,$3,$4)',
      [stopId, type, photo || null, notes || '']
    );
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
  addDriver: async (pool, name, pin, phone = '', email = '') => {
    const res = await pool.query(
      'INSERT INTO drivers (name, pin, phone, email) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, String(pin), phone, email]
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
  getDriverByPin: async (pool, pin) => {
    const res = await pool.query('SELECT * FROM drivers WHERE pin = $1 LIMIT 1', [String(pin)]);
    return res.rows[0] || null;
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
    const res = await pool.query(
      'INSERT INTO driver_sessions (driver_id, km_initial, status) VALUES ($1,$2,\'active\') RETURNING id',
      [driverId, kmInitial]
    );
    return res.rows[0].id;
  },
  endSession: async (pool, sessionId, kmFinal) => {
    const kmTotal = parseFloat((kmFinal - (await pool.query('SELECT km_initial FROM driver_sessions WHERE id=$1', [sessionId])).rows[0].km_initial).toFixed(1));
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
  }
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
  listStops: (db, filters = {}) => {
    let stops = db._store.stops.slice();
    if (filters.driver_id !== undefined) stops = stops.filter((s) => s.driver_id === filters.driver_id);
    if (filters.status) stops = stops.filter((s) => s.status === filters.status);
    if (filters.from) stops = stops.filter((s) => (s.created_at || '') >= filters.from);
    if (filters.to) stops = stops.filter((s) => (s.created_at || '') <= filters.to);
    return stops.sort((a, b) => (a.stop_number || 0) - (b.stop_number || 0));
  },
  addStop: (db, stopNumber, address, status = 'pending', driverId = null) => {
    const id = db.nextStopId();
    db._store.stops.push({ id, stop_number: stopNumber, address, status, driver_id: driverId, created_at: new Date().toISOString() });
    db._save(); return id;
  },
  updateStop: (db, id, fields) => {
    const stop = db._store.stops.find((s) => s.id === id);
    if (stop) { Object.assign(stop, fields); db._save(); }
  },
  deleteStop: (db, id) => { db._store.stops = db._store.stops.filter((s) => s.id !== id); db._save(); },
  clearStops: (db) => { db._store.stops = []; db._save(); },
  addIncident: (db, stopId, type, photo, notes) => {
    db._store.incidents.push({ id: db._store.incidents.length + 1, stop_id: stopId, type, photo_data: photo || null, notes: notes || '', created_at: new Date().toISOString() });
    db._save();
  },
  setSetting: (db, key, value) => { db._store.settings[key] = parseFloat(value); db._save(); },
  getSettings: (db) => ({ ...db._store.settings }),
  savePod: (db, stopId, filePath) => { db._store.pods[stopId] = filePath; db._save(); },
  addDriver: (db, name, pin, phone = '', email = '') => {
    const id = (db._store.drivers.reduce((m, d) => Math.max(m, d.id || 0), 0)) + 1;
    db._store.drivers.push({ id, name, pin: String(pin), phone, email: email || '', active: true, fuel_type: '', cost_per_km: 0 });
    db._save(); return id;
  },
  updateDriverCost: (db, id, fuelType, costPerKm) => {
    const d = db._store.drivers.find((x) => x.id === id);
    if (d) { d.fuel_type = fuelType || ''; d.cost_per_km = costPerKm || 0; db._save(); }
  },
  listDrivers: (db) => db._store.drivers.slice(),
  getDriverByPin: (db, pin) => db._store.drivers.find((d) => d.pin === String(pin)),
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
    const id = sessions.length + 1;
    sessions.push({ id, driver_id: driverId, km_initial: kmInitial, km_final: null, km_total: null, date: new Date().toISOString().slice(0,10), started_at: new Date().toISOString(), ended_at: null, status: 'active' });
    db._store.sessions = sessions; db._save(); return id;
  },
  endSession: (db, sessionId, kmFinal) => {
    const session = (db._store.sessions || []).find(s => s.id === sessionId);
    if (!session) throw new Error('Sesión no encontrada');
    session.km_final = kmFinal;
    session.km_total = parseFloat((kmFinal - session.km_initial).toFixed(1));
    session.ended_at = new Date().toISOString();
    session.status = 'closed';
    db._save(); return session.km_total;
  },
  getActiveSession: (db, driverId) => {
    return (db._store.sessions || []).filter(s => s.driver_id === driverId && s.status === 'active').sort((a,b) => b.id - a.id)[0] || null;
  },
  listSessions: (db, driverId) => {
    return (db._store.sessions || []).filter(s => s.driver_id === driverId).sort((a,b) => b.started_at.localeCompare(a.started_at));
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

  // 2) Fallback: JSON file
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
