// Capa de datos KAVANA RouteFleet (SQLite).
// Esquema y acceso a paradas, incidencias, ajustes OPEX y PODs.

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB = path.join(__dirname, '../../routefleet.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stop_number INTEGER,
  address TEXT,
  status TEXT DEFAULT 'pending',
  signature TEXT,
  receiver_name TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stop_id INTEGER,
  type TEXT,
  photo_data TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS pods (
  stop_id INTEGER PRIMARY KEY,
  file_path TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

export function initDb(dbPath = DEFAULT_DB) {
  const db = new Database(dbPath);
  db.exec(SCHEMA);
  const count = db.prepare("SELECT COUNT(*) AS c FROM settings").get().c;
  if (count === 0) {
    const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    insert.run('cost_per_km', '0.30');
    insert.run('cost_per_hour', '15');
  }
  return db;
}

export const queries = {
  listStops: (db) => db.prepare('SELECT * FROM stops ORDER BY stop_number ASC').all(),
  addStop: (db, stopNumber, address, status = 'pending') =>
    db.prepare('INSERT INTO stops (stop_number, address, status) VALUES (?, ?, ?)').run(stopNumber, address, status),
  updateStop: (db, id, fields) => {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const set = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE stops SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
  },
  deleteStop: (db, id) => db.prepare('DELETE FROM stops WHERE id = ?').run(id),
  clearStops: (db) => db.prepare('DELETE FROM stops').run(),
  addIncident: (db, stopId, type, photo, notes) =>
    db.prepare('INSERT INTO incidents (stop_id, type, photo_data, notes) VALUES (?, ?, ?, ?)').run(stopId, type, photo, notes || ''),
  setSetting: (db, key, value) =>
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run(key, String(value), String(value)),
  getSettings: (db) => {
    const rows = db.prepare('SELECT * FROM settings').all();
    const s = {};
    rows.forEach((r) => (s[r.key] = parseFloat(r.value) || 0));
    return s;
  },
  savePod: (db, stopId, filePath) =>
    db.prepare('INSERT OR REPLACE INTO pods (stop_id, file_path) VALUES (?, ?)').run(stopId, filePath)
};

export default { initDb, queries };
