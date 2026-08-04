// Capa de datos KAVANA RouteFleet (store en archivo JSON).
// Sustituye a SQLite para despliegue sin compilacion nativa (Render free, etc).
// Mantiene la MISMA interfaz que la version SQLite: initDb() y queries.*.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB = process.env.ROUTEFLEET_DB || path.join(__dirname, '../../routefleet.json');

function emptyStore() {
  return {
    stops: [],
    incidents: [],
    settings: { cost_per_km: 0.3, cost_per_hour: 15 },
    pods: {}
  };
}

function load(dbPath) {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

function persist(dbPath, store) {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2));
}

export function initDb(dbPath = DEFAULT_DB) {
  const store = load(dbPath);
  // Asegura settings por defecto si faltan
  if (typeof store.settings.cost_per_km !== 'number') store.settings.cost_per_km = 0.3;
  if (typeof store.settings.cost_per_hour !== 'number') store.settings.cost_per_hour = 15;
  persist(dbPath, store);

  // Devuelve un objeto "db" con los metodos que espera queries (firmas iguales)
  return {
    _path: dbPath,
    _store: store,
    _save() {
      persist(this._path, this._store);
    },
    nextStopId() {
      const max = store.stops.reduce((m, s) => Math.max(m, s.id || 0), 0);
      return max + 1;
    }
  };
}

export const queries = {
  listStops: (db) => db._store.stops.slice().sort((a, b) => (a.stop_number || 0) - (b.stop_number || 0)),
  addStop: (db, stopNumber, address, status = 'pending') => {
    const id = db.nextStopId();
    db._store.stops.push({
      id,
      stop_number: stopNumber,
      address,
      status,
      created_at: new Date().toISOString()
    });
    db._save();
    return id;
  },
  updateStop: (db, id, fields) => {
    const stop = db._store.stops.find((s) => s.id === id);
    if (!stop) return;
    Object.assign(stop, fields);
    db._save();
  },
  deleteStop: (db, id) => {
    db._store.stops = db._store.stops.filter((s) => s.id !== id);
    db._save();
  },
  clearStops: (db) => {
    db._store.stops = [];
    db._save();
  },
  addIncident: (db, stopId, type, photo, notes) => {
    db._store.incidents.push({
      id: db._store.incidents.length + 1,
      stop_id: stopId,
      type,
      photo_data: photo || null,
      notes: notes || '',
      created_at: new Date().toISOString()
    });
    db._save();
  },
  setSetting: (db, key, value) => {
    db._store.settings[key] = parseFloat(value);
    db._save();
  },
  getSettings: (db) => ({ ...db._store.settings }),
  savePod: (db, stopId, filePath) => {
    db._store.pods[stopId] = filePath;
    db._save();
  }
};

export default { initDb, queries };
