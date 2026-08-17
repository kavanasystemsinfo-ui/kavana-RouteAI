// Migraciones SQL versionadas para KAVANA Route AI (Fase 3, 2026-08-17).
//
// Antes: todo el esquema vivía en un SCHEMA_SQL monolítico en db.js y se
// aplicaba con CREATE TABLE IF NOT EXISTS en cada arranque. Eso funcionaba
// para el MVP pero no dejaba rastro de QUÉ versión de esquema tiene cada
// entorno, ni permitía evolucionar columnas de forma auditable.
//
// Ahora: archivos `migrations/NNN_nombre.sql` (NNN = número de orden, 001+).
// Al arrancar, `runMigrations` crea la tabla `schema_migrations`, lista los
// archivos, aplica en orden solo los NO aplicados y registra su versión.
// Trade-off: sin rollback (las migraciones son aditivas por convención).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// migrations/ vive junto a src/ (la raíz de server/)
export const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '../migrations');

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

export async function listPendingMigrations(pool, dir = DEFAULT_MIGRATIONS_DIR) {
  const files = listSqlFiles(dir);
  if (files.length === 0) return [];
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
  )`);
  const res = await pool.query('SELECT version FROM schema_migrations');
  const applied = new Set(res.rows.map((r) => r.version));
  return files
    .filter((f) => !applied.has(f.slice(0, 3)))
    .map((f) => ({
      version: f.slice(0, 3),
      filename: f,
      sql: fs.readFileSync(path.join(dir, f), 'utf8'),
    }));
}

export async function runMigrations(pool, dir = DEFAULT_MIGRATIONS_DIR) {
  const pending = await listPendingMigrations(pool, dir);
  const applied = [];
  for (const m of pending) {
    await pool.query(m.sql);
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
    applied.push(m.version);
    console.log(`[migrations] aplicada ${m.filename}`);
  }
  if (applied.length === 0) console.log('[migrations] esquema al día (0 pendientes)');
  return applied;
}

export default { runMigrations, listPendingMigrations, DEFAULT_MIGRATIONS_DIR };